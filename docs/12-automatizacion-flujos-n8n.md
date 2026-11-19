# Automatización Operativa y Flujos de Trabajo con n8n

En el marco del proyecto Sodería (TP Final HIA), se implementó una plataforma de automatización de operaciones (AIOps / ChatOps) utilizando **n8n** (perfil `automatizacion` en `docker-compose.yml`, expuesto en `http://localhost:5678`).

Los tres flujos de trabajo automatizan las operaciones críticas del clúster sin intervención humana:

| Flujo | Para qué sirve en pocas palabras |
|-------|----------------------------------|
| **Flujo 1** | Recibe alertas de Alertmanager, abre tickets en MantisBT, detecta duplicados, y cierra automáticamente los tickets cuando el problema se resuelve. |
| **Flujo 2** | Verifica diariamente que existan backups válidos de PostgreSQL. Si faltan o están desactualizados, abre un ticket y envía un email de alerta. Si se recuperan, cierra el ticket automáticamente. |
| **Flujo 3** | Genera un informe técnico diario del estado de la infraestructura usando IA (Gemini), lo guarda en Nextcloud y lo envía por email al equipo de operaciones. |

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

> **¿Para qué sirve?**  
> Cuando Alertmanager detecta un problema en el clúster (nodo caído, réplica retrasada, servicio no disponible), este flujo actúa como dispatcher automático: abre un ticket en MantisBT con el detalle del incidente, asigna al responsable según el tipo de alerta y envía un email rojo al equipo. Si la alerta llega de nuevo antes de resolverse, agrega una nota al ticket existente en lugar de duplicarlo. Cuando Alertmanager informa que el problema se resolvió, el flujo cierra el ticket automáticamente y envía un email verde de recuperación.

* **Identificador n8n:** `PBXS83CAm5OGgvYb`
* **Archivo versionado:** `cluster/observabilidad/flujo_01_alertas_infraestructura.json`
* **Trigger:** Webhook HTTP `POST /webhook/soderia-alertas-infraestructura` con autenticación Basic Auth (`alertmanager`).
* **Estado:** Publicado y Activo (`active: true`).

### Arquitectura y Capacidades
1. **Deduplicación Inteligente (Anti-Flapping):** Al recibir un evento `firing`, consulta por API REST las incidencias abiertas en MantisBT. Si ya existe un ticket abierto para ese servicio o alerta, **no crea un ticket duplicado**; añade una **Nota de Seguimiento** cronológica con telemetría en vivo.
2. **Ciclo de Vida Completo y Auto-Resolución:** Al recibir el evento `resolved` desde Alertmanager (`send_resolved: true`), localiza el ticket abierto, lo actualiza automáticamente a estado **Resuelto**, le inserta una nota de remediación y despacha un correo verde de restablecimiento.
3. **Telemetría en Vivo:** En el instante del disparo, consulta la API de Prometheus (`/api/v1/query?query=up`) para diagnosticar cuántos objetivos están UP/DOWN y adjuntarlo al ticket.
4. **Matriz de Asignación Preventiva:** Mapea automáticamente la especialidad del incidente:
   * PostgreSQL / Replicación → `Méndez / Orellana (DBA & Clustering)`
   * Contenedores / Recursos → `Guari (Contenedores & Recursos)`
   * Observabilidad / Métricas → `Figueroa (Observabilidad)`
5. **Notificaciones Interactivas:** Correos HTML con botones de acción directa a MantisBT (`http://localhost:8989/view.php?id=...`) y al Dashboard de Grafana con la ventana temporal del incidente.
6. **Auditoría:** Inserta registros en `public.n8n_execution_logs` con estados semánticos (`CREATED`, `DEDUP_NOTE`, `RESOLVED`).

### Cómo probar el Flujo 1

Ejecutar desde PowerShell en el orden indicado para recorrer los 3 escenarios:

**Paso 1 — Alerta nueva** (crea ticket + email rojo):
```powershell
$headers = @{
    Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("alertmanager:0bdb2c990ed7f31644bdbd0863cf09bdaa02db6045d2f91ddf70d62082af6112"))
    "Content-Type" = "application/json"
}
$payloadFiring = @{
    receiver = "n8n-mantis-webhook"; status = "firing"
    alerts = @(@{
        status = "firing"
        labels = @{ alertname = "PostgresNodeDown"; instance = "postgres_nodo2:5432"; job = "postgres_cluster"; severity = "critical" }
        annotations = @{ summary = "Nodo 2 fuera de línea"; description = "El contenedor no responde al probe de Patroni." }
        startsAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://localhost:5678/webhook/soderia-alertas-infraestructura" -Headers $headers -Body $payloadFiring
```
✅ **Verificar:** MantisBT (`http://localhost:8989`) → ticket nuevo "PostgresNodeDown". Mailpit (`http://localhost:8026`) → email rojo.

**Paso 2 — Deduplicación** (misma alerta → solo agrega nota, sin ticket nuevo):
```powershell
# Reenviar el mismo payload
Invoke-RestMethod -Method Post -Uri "http://localhost:5678/webhook/soderia-alertas-infraestructura" -Headers $headers -Body $payloadFiring
```
✅ **Verificar:** MantisBT → el ticket anterior ahora tiene una **nota de seguimiento** adicional, sin ticket duplicado.

**Paso 3 — Recuperación** (cierra ticket + email verde):
```powershell
$payloadResolved = @{
    receiver = "n8n-mantis-webhook"; status = "resolved"
    alerts = @(@{
        status = "resolved"
        labels = @{ alertname = "PostgresNodeDown"; instance = "postgres_nodo2:5432"; job = "postgres_cluster"; severity = "critical" }
        annotations = @{ summary = "Nodo 2 fuera de línea"; description = "El contenedor no responde al probe de Patroni." }
        startsAt = (Get-Date).AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ssZ")
        endsAt   = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    })
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://localhost:5678/webhook/soderia-alertas-infraestructura" -Headers $headers -Body $payloadResolved
```
✅ **Verificar:** MantisBT → ticket en estado **Resuelto**. Mailpit → email verde "[RECUPERADO]".

**Verificar auditoría en PostgreSQL:**
```powershell
docker exec postgres_nodo1 psql -U postgres -d soderia -c "SELECT status, details, created_at FROM public.n8n_execution_logs WHERE workflow_name LIKE '%Flujo 1%' ORDER BY id DESC LIMIT 5;"
```
Resultado esperado: 3 filas con estados `CREATED`, `DEDUP_NOTE`, `RESOLVED`.

---

## 3. Flujo 2: Verificación de Backups de PostgreSQL

> **¿Para qué sirve?**  
> Garantiza la continuidad del negocio verificando cada 24 horas que existan backups válidos de la base de datos. Detecta automáticamente si un backup está ausente, vacío o tiene más de 25 horas de antigüedad (superando el RPO establecido). En caso de fallo, abre un ticket en MantisBT y envía un email crítico. Si el backup se recupera en la siguiente ejecución, resuelve el ticket automáticamente. También puede dispararse manualmente vía webhook en cualquier momento.

* **Identificador n8n:** `KmBG5FtntcCHYXoo`
* **Archivo versionado:** `cluster/observabilidad/flujo_02_verificacion_backups.json`
* **Triggers:** Programado cada 24 horas (`scheduleTrigger`) + Webhook manual `POST /webhook/verificar-backups`.
* **Estado:** Publicado y Activo (`active: true`).

### Arquitectura y Funcionamiento (18 nodos)
1. **Inspección de Archivos:** Lee el volumen montado `/backups` (bind mount de `./datos/backups` en el host, solo lectura).
2. **Consulta de DB:** Obtiene el tamaño actual de la base de datos PostgreSQL para incluirlo en el reporte.
3. **Consulta de Tickets Abiertos:** Antes de crear un ticket, verifica en MantisBT si ya existe uno de backup abierto (evita duplicados).
4. **Criterios de Validación:**
   * Existencia de archivos `.dump` o `.sql`
   * Tamaño mayor a 512 bytes (descarta archivos corruptos o truncados)
   * Antigüedad ≤ 25 horas (garantía de RPO diario)
   * Magic bytes `PGDMP` (valida que el archivo es un dump real de PostgreSQL)
5. **Rama de Éxito con Recuperación:** Si el backup es válido y había un ticket abierto, lo resuelve automáticamente y agrega nota de recuperación.
6. **Rama de Falla con Deduplicación:** Si falla y ya existe un ticket abierto, agrega una nota de seguimiento (sin duplicar). Si no existe ticket, crea uno nuevo con severidad `major`.
7. **Emails HTML:** Plantilla verde (recuperación) y roja (falla crítica) enviadas vía Mailpit.
8. **Auditoría:** Registra cada ejecución en `public.n8n_execution_logs` con estado `SUCCESS`, `RESOLVED`, `FAILED` o `DEDUP_NOTE`.

### Cómo probar el Flujo 2

#### Prueba 1 — Backup válido (escenario normal)

```powershell
# Disparar el flujo manualmente vía webhook
Invoke-RestMethod -Uri "http://localhost:5678/webhook/verificar-backups" -Method POST -ContentType "application/json" -Body "{}"
```

Resultado inmediato: `success: True`

Verificar en PostgreSQL:
```powershell
docker exec postgres_nodo1 psql -U postgres -d soderia -c "SELECT status, details, created_at FROM public.n8n_execution_logs WHERE workflow_name LIKE '%Backup%' ORDER BY id DESC LIMIT 1;"
```
Resultado esperado: fila con `status = SUCCESS` y detalle del archivo encontrado (nombre, tamaño en MB, antigüedad en horas).  
Verificar en Mailpit (`http://localhost:8026`): email con asunto `[OK] Backup de PostgreSQL verificado`.

---

#### Prueba 2 — Sin backup (escenario de falla y auto-recuperación)

```powershell
# Paso 1: Ocultar el archivo de backup
Rename-Item ".\datos\backups\soderia-20261119T155931Z-kkKpaP.dump" "soderia-20261119T155931Z-kkKpaP.dump.bak"

# Paso 2: Disparar el flujo — debe detectar el fallo
Invoke-RestMethod -Uri "http://localhost:5678/webhook/verificar-backups" -Method POST -ContentType "application/json" -Body "{}"
```

Verificar en PostgreSQL: `status = FAILED`, mensaje `[CRITICAL] Fallo en verificación de backups`.  
Verificar en MantisBT (`http://localhost:8989`): ticket nuevo con título `[ALERTA BACKUP]`.  
Verificar en Mailpit (`http://localhost:8026`): email rojo `[CRÍTICO] Fallo en verificación de backup`.

```powershell
# Paso 3: Restaurar el backup
Rename-Item ".\datos\backups\soderia-20261119T155931Z-kkKpaP.dump.bak" "soderia-20261119T155931Z-kkKpaP.dump"

# Paso 4: Disparar de nuevo — debe auto-recuperarse
Invoke-RestMethod -Uri "http://localhost:5678/webhook/verificar-backups" -Method POST -ContentType "application/json" -Body "{}"
```

Resultado esperado: MantisBT → ticket anterior en estado **Resuelto**. Mailpit → email verde `[RECUPERADO]`. PostgreSQL → fila con `status = RESOLVED`.

---

## 4. Flujo 3: Informe de Rendimiento con RAG e IA Generativa

> **¿Para qué sirve?**  
> Genera automáticamente un informe técnico diario del estado de la infraestructura usando Inteligencia Artificial (Google Gemini). El flujo recolecta métricas reales de Prometheus, recupera runbooks y procedimientos operativos de PostgreSQL, construye un prompt enriquecido con ese contexto (patrón RAG) y le pide a Gemini que redacte un análisis técnico con diagnóstico y plan de acción. El informe resultante se sube a Nextcloud y se envía por email al equipo de operaciones.

* **Identificador n8n:** `dHwOKucI5nMcw77j`
* **Archivo versionado:** `cluster/observabilidad/flujo_03_informe_rag_ia.json`
* **Trigger:** Programado diariamente cada 24 horas (`scheduleTrigger`) o ejecutable bajo demanda.
* **Estado:** Publicado y Activo (`active: true`).

### Arquitectura y Funcionamiento (Patrón RAG)
1. **Recolección de Métricas en Vivo (R):** Consulta Prometheus (`/api/v1/query?query=up`) para obtener el estado real de todos los servicios del clúster en ese instante.
2. **Recuperación de Contexto (R):** Consulta PostgreSQL para traer los runbooks y procedimientos operativos indexados:
   ```sql
   SELECT service_name, issue_type, content FROM public.infrastructure_runbooks;
   ```
3. **Construcción del Prompt Enriquecido (A):** Calcula ratio de disponibilidad, identifica servicios caídos y construye un prompt con rol *Ingeniero DevOps Sr.* que combina métricas reales + runbooks relevantes.
4. **Generación con IA (G):** Google Gemini (`gemini-3.8-flash`) redacta un informe técnico en Markdown con Resumen Ejecutivo, Diagnóstico por Servicio y Plan de Acción.
5. **Persistencia en Nextcloud:** Sube el informe vía WebDAV con nombre `informe_rag_rendimiento_YYYY-MM-DD_HH-mm-ss.md`.
6. **Notificación y Auditoría:** Envía el informe por email a `operaciones@soderia.local` y registra la ejecución en `public.n8n_execution_logs`.

### Cómo probar el Flujo 3

**Opción A — Desde la UI de n8n:**
1. Abrir `http://localhost:5678` → flujo `03 - Informe de Rendimiento con RAG e IA Generativa`.
2. Clic en **Execute Workflow**.

**Opción B — Desde PowerShell (si tiene webhook configurado):**
```powershell
Invoke-RestMethod -Uri "http://localhost:5678/webhook/informe-rag" -Method POST -ContentType "application/json" -Body "{}"
```

**Verificar en Nextcloud** (`http://localhost:8085`, usuario `admin` / contraseña `admin123`):  
Buscar el archivo `informe_rag_rendimiento_*.md` generado en la carpeta raíz.

**Verificar en Mailpit** (`http://localhost:8026`):  
Email con asunto `[INFORME RAG+IA Generativa] Reporte Técnico de Infraestructura`.

**Verificar en PostgreSQL:**
```powershell
docker exec postgres_nodo1 psql -U postgres -d soderia -c "SELECT status, details, created_at FROM public.n8n_execution_logs WHERE workflow_name LIKE '%03%' ORDER BY id DESC LIMIT 1;"
```
Resultado esperado: fila con `status = SUCCESS` y resumen del informe generado.

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
