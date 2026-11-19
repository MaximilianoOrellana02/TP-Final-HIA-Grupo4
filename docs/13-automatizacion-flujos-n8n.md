# Automatización Operativa y Flujos de Trabajo con n8n

En el marco del proyecto Sodería (TP Final HIA), se implementó una plataforma de automatización de operaciones (AIOps / ChatOps) utilizando **n8n** (perfil `automatizacion` en `docker-compose.yml`, expuesto en `http://localhost:5678`).

Los tres flujos de trabajo resuelven la orquestación del ciclo de vida de incidentes, la garantía de continuidad de negocio (backups) y la observabilidad inteligente asistida por IA generativa (RAG).

---

## 1. Mapa de Servicios y URLs de Verificación

| Servicio | URL / Acceso | Rol en la Automatización |
|---|---|---|
| **n8n Editor** | `http://localhost:5678` | Diseñador y orquestador de flujos de trabajo |
| **MantisBT** | `http://localhost:8989` | Gestión de incidencias (tickets, notas y estados) |
| **Mailpit** | `http://localhost:8026` | Servidor SMTP local de notificaciones interactivas |
| **Nextcloud** | `http://localhost:8085` | Repositorio documental de informes generados por IA |
| **Prometheus** | `http://localhost:9090` *(interno `red_cluster`)* | Recolección de telemetría y métricas |
| **Alertmanager** | `http://localhost:9093` | Enrutador de alertas hacia el webhook de n8n |
| **Grafana** | `http://localhost:3000` | Dashboards de monitoreo vinculados en los tickets |
| **PostgreSQL** | `haproxy:5432` / `postgres_nodo1` | Tabla de auditoría: `public.n8n_execution_logs` |

---

## 2. Flujo 1: Alertas Automáticas de Infraestructura y Ciclo de Vida de Incidentes

* **Identificador n8n:** `PBXS83CAm5OGgvYb`
* **Archivo versionado:** `cluster/observabilidad/flujo_01_alertas_infraestructura.json`
* **Trigger:** Webhook HTTP `POST /webhook/soderia-alertas-infraestructura` con autenticación Basic Auth (`alertmanager`).
* **Estado:** Publicado y Activo (`active: true`).

### Arquitectura y Capacidades Avanzadas
1. **Deduplicación Inteligente (Anti-Flapping):** Al recibir un evento `firing`, consulta por API REST las incidencias abiertas en MantisBT. Si ya existe un ticket abierto para ese servicio o alerta, **no crea un ticket duplicado**; añade una **Nota de Seguimiento** cronológica con telemetría en vivo.
2. **Ciclo de Vida Completo y Auto-Resolución:** Al recibir el evento `resolved` desde Alertmanager (`send_resolved: true`), localiza el ticket abierto, lo actualiza automáticamente a estado **Resuelto (`resolved` / `fixed`)**, le inserta una nota de remediación y despacha un correo verde de restablecimiento.
3. **Telemetría en Vivo:** En el instante del disparo, consulta la API de Prometheus (`/api/v1/query?query=up`) para diagnosticar cuántos objetivos están UP/DOWN y adjuntarlo al ticket.
4. **Matriz de Asignación Preventiva:** Mapea automáticamente la especialidad del incidente:
   * PostgreSQL / Replicación $\rightarrow$ `Méndez / Orellana (DBA & Clustering)`
   * Contenedores / Recursos $\rightarrow$ `Guari (Contenedores & Recursos)`
   * Observabilidad / Métricas $\rightarrow$ `Figueroa (Observabilidad)`
5. **Notificaciones Interactivas:** Correos HTML con botones de acción directa a MantisBT (`http://localhost:8989/view.php?id=...`) y al Dashboard de Grafana con la ventana temporal del incidente (`from=now-1h&to=now`).
6. **Auditoría:** Inserta registros en `public.n8n_execution_logs` con estados semánticos (`CREATED`, `DEDUP_NOTE`, `RESOLVED`).

### Cómo verificar el Flujo 1
Desde una terminal de PowerShell:

```powershell
# 1. Credenciales de Alertmanager
$headers = @{
    Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("alertmanager:0bdb2c990ed7f31644bdbd0863cf09bdaa02db6045d2f91ddf70d62082af6112"))
    "Content-Type" = "application/json"
}

# 2. Prueba de Alerta Nueva (Crea Ticket e Email Rojo)
$payloadFiring = @{
    receiver = "n8n-mantis-webhook"
    status   = "firing"
    alerts   = @(@{
        status = "firing"
        labels = @{ alertname = "PostgresNodeDown"; instance = "postgres_nodo2:5432"; job = "postgres_cluster"; severity = "critical" }
        annotations = @{ summary = "Nodo 2 fuera de línea"; description = "El contenedor no responde al probe de Patroni." }
        startsAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://localhost:5678/webhook/soderia-alertas-infraestructura" -Headers $headers -Body $payloadFiring

# 3. Prueba de Deduplicación (Reenvío: Agrega Nota sin duplicar ticket)
Invoke-RestMethod -Method Post -Uri "http://localhost:5678/webhook/soderia-alertas-infraestructura" -Headers $headers -Body $payloadFiring

# 4. Prueba de Recuperación (Cierra Ticket a Resuelto y manda Email Verde)
$payloadResolved = @{
    receiver = "n8n-mantis-webhook"
    status   = "resolved"
    alerts   = @(@{
        status = "resolved"
        labels = @{ alertname = "PostgresNodeDown"; instance = "postgres_nodo2:5432"; job = "postgres_cluster"; severity = "critical" }
        annotations = @{ summary = "Nodo 2 fuera de línea"; description = "El contenedor no responde al probe de Patroni." }
        startsAt = (Get-Date).AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ssZ")
        endsAt   = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://localhost:5678/webhook/soderia-alertas-infraestructura" -Headers $headers -Body $payloadResolved
```

---

## 3. Flujo 2: Verificación de Backups de PostgreSQL

* **Identificador n8n:** `KmBG5FtntcCHYXoo`
* **Archivo versionado:** `cluster/observabilidad/flujo_02_verificacion_backups.json`
* **Trigger:** Programado diariamente cada 24 horas (`scheduleTrigger`).
* **Estado:** Publicado y Activo (`active: true`).

### Arquitectura y Funcionamiento
1. **Inspección de Archivos:** Lee el volumen montado `/backups` (bind mount de `./backups` en el host) mediante Node.js nativo (`fs`).
2. **Criterios de Validación:**
   * Existencia de archivos con extensión `.dump` o `.sql`.
   * Tamaño mayor a 0 bytes (control de archivos corruptos o truncados).
   * Antigüedad del archivo más reciente $\le 25$ horas (garantía de RPO diario).
3. **Rama de Éxito:** Si el backup es válido, registra un evento `SUCCESS` con el nombre, tamaño en MB y antigüedad en `public.n8n_execution_logs`.
4. **Rama de Falla:** Si no hay backups, están corruptos o superan las 25 horas:
   * Crea inmediatamente una incidencia en MantisBT: `[ALERTA BACKUP] Fallo en verificación periódica de PostgreSQL` con severidad `major` y prioridad `high`.
   * Envía un email de alerta crítica a `operaciones@soderia.local` vía Mailpit.
   * Registra el fallo con estado `FAILED` en la tabla de auditoría.

### Cómo verificar el Flujo 2

#### Verificación en modo exitoso (Normal):
1. Generar un backup reciente si no existe:
   ```bash
   docker compose run --rm backup
   ```
2. Ejecutar el flujo manualmente desde n8n (`http://localhost:5678` $\rightarrow$ Flujo 02 $\rightarrow$ *Test step / Execute workflow*).
3. Comprobar el log de auditoría en PostgreSQL:
   ```bash
   docker exec postgres_nodo1 psql -U soderia -d soderia -c "SELECT * FROM n8n_execution_logs WHERE workflow_name LIKE '%02%' ORDER BY id DESC LIMIT 1;"
   ```

#### Verificación en modo falla:
1. Mover temporalmente los backups fuera de la carpeta `./backups`:
   ```powershell
   # En Windows PowerShell:
   Get-ChildItem ./backups -File | Rename-Item -NewName { $_.Name + ".bak" }
   ```
2. Ejecutar el flujo en n8n.
3. Verificar la creación automática del ticket en MantisBT (`http://localhost:8989`) y el correo recibido en Mailpit (`http://localhost:8026`).
4. Restaurar los archivos renombrados:
   ```powershell
   Get-ChildItem ./backups -Filter "*.bak" | Rename-Item -NewName { $_.Name.Replace(".bak", "") }
   ```

---

## 4. Flujo 3: Informe de Rendimiento con RAG e IA Generativa

* **Identificador n8n:** `dHwOKucI5nMcw77j`
* **Archivo versionado:** `cluster/observabilidad/flujo_03_informe_rag_ia.json`
* **Trigger:** Programado diariamente cada 24 horas (`scheduleTrigger`) o ejecutable bajo demanda.
* **Estado:** Publicado y Activo (`active: true`).

### Arquitectura y Funcionamiento (Patrón RAG)
1. **Recolección de Métricas en Vivo:** Realiza una petición HTTP GET a Prometheus (`http://prometheus:9090/api/v1/query?query=up`) analizando la disponibilidad porcentual de todos los servicios del clúster.
2. **Recuperación de Contexto (Retrieval):** Consulta la base de datos PostgreSQL:
   ```sql
   SELECT service_name, issue_type, content FROM public.infrastructure_runbooks;
   ```
   recuperando procedimientos operativos estándar (SOPs) y manuales de mitigación previamente indexados.
3. **Construcción del Prompt Enriquecido (Augmentation):** Un nodo de código analiza los servicios caídos (si los hay), calcula el ratio de disponibilidad y arma un prompt estructurado con instrucciones de rol: *Ingeniero DevOps Sr.*
4. **Generación con IA (Generation):** El nodo de **Google Gemini (`gemini-3.8-flash`)** analiza los datos reales contra los runbooks recuperados y redacta un informe técnico exhaustivo en Markdown (Resumen Ejecutivo, Diagnóstico de Servicios y Plan de Acción).
5. **Persistencia en Nextcloud:** Sube el informe generado a Nextcloud mediante WebDAV:
   `PUT http://nextcloud/remote.php/dav/files/admin/informe_rag_rendimiento_YYYY-MM-DD_HH-mm-ss.md`
6. **Notificación y Auditoría:** Notifica el informe completo por correo a `operaciones@soderia.local` y registra el resumen en `public.n8n_execution_logs`.

### Cómo verificar el Flujo 3
1. Abrir n8n en `http://localhost:5678`.
2. Abrir el flujo **`03 - Informe de Rendimiento con RAG e IA Generativa`**.
3. Hacer clic en **Execute Workflow** (o *Test Step* en el disparador).
4. **Verificar en Nextcloud:**
   * Ingresar a `http://localhost:8085` (Usuario: `admin` / Contraseña: `admin123`).
   * En la carpeta de archivos, abrir el nuevo documento generado `informe_rag_rendimiento_*.md`.
5. **Verificar en Mailpit:**
   * Ingresar a `http://localhost:8026`.
   * Abrir el correo con asunto `[INFORME RAG+IA Generativa] Reporte Técnico de Infraestructura` para leer el análisis técnico redactado por Gemini.
6. **Verificar en PostgreSQL:**
   ```bash
   docker exec postgres_nodo1 psql -U soderia -d soderia -c "SELECT id, alert_name, details, created_at FROM n8n_execution_logs WHERE workflow_name LIKE '%03%' ORDER BY id DESC LIMIT 1;"
   ```

---

## 5. Esquema de la Tabla de Auditoría (`public.n8n_execution_logs`)

Todos los flujos reportan centralizadamente su telemetría en PostgreSQL para trazabilidad y cálculo de MTTR (Mean Time to Resolution):

```sql
CREATE TABLE public.n8n_execution_logs (
    id SERIAL PRIMARY KEY,
    workflow_name VARCHAR(100) NOT NULL,
    execution_id VARCHAR(50),
    alert_name VARCHAR(100),
    severity VARCHAR(20),
    status VARCHAR(20) NOT NULL, -- CREATED, DEDUP_NOTE, RESOLVED, SUCCESS, FAILED
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
