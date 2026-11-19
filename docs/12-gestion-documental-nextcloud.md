# Punto 12: Gestión Documental con Nextcloud

## 1. Arquitectura del servicio
- **Servicios en `docker-compose.yml`** (perfil `documentacion`, red `interna`):
  - `nextcloud-db` (`postgres:17-alpine`): base de datos dedicada con volumen `nextcloud_db_data`.
  - `nextcloud` (`nextcloud:apache`): servidor web y WebDAV con volumen `nextcloud_data`, expuesto únicamente en loopback (`127.0.0.1:${NEXTCLOUD_PORT:-8082}:80`).
- **Aislamiento de red**: `nextcloud` opera en la red `interna` (compartida con `n8n` y `mantisbt`, separada de `red_cluster`), permitiendo que los flujos de `n8n` se conecten por nombre interno `http://nextcloud`.

## 2. Arranque e inicialización
1. Copiar las variables de Nextcloud desde `.env.example` hacia `.env` y definir contraseñas reales (nunca subir `.env` al repositorio).
2. Levantar el perfil documental:
   ```powershell
   docker compose --profile documentacion up -d
   ```
3. Inicializar grupos, usuarios, permisos y estructura de carpetas (`scripts/setup-nextcloud.ps1` en Windows o `scripts/setup-nextcloud.sh` en Linux/macOS):
   ```powershell
   .\scripts\setup-nextcloud.ps1
   ```
4. Acceder localmente en `http://localhost:8082`.

## 3. Estructura de carpetas compartidas (`Soderia-TP-Final/`)
- `01-Documentacion-Tecnica/`: informes por punto del TP, arquitectura y manuales.
- `02-Informes-Pruebas/`: resultados de pruebas de carga, failover y optimización.
- `03-Configuraciones-Infra/`: plantillas y configuraciones de referencia (`.env.example`, `haproxy.cfg`, `patroni.yml`, sin secretos).
- `04-Reportes-n8n/`: informes automáticos generados y subidos por flujos de `n8n`.
- `05-Evidencias/`: capturas, exportaciones y registro de versiones de entregables.

## 4. Matriz de permisos (Team Folders / `groupfolders`)

| Grupo | Usuario ejemplo | Permisos asignados | Alcance |
| --- | --- | --- | --- |
| `admin` *(administrador)* | `${NEXTCLOUD_ADMIN_USER}` | Control total | Administración de instancia, apps y cuotas |
| `equipo` | `equipo_dev` | `read`, `write`, `create`, `delete`, `share` | Carga, edición y versionado de entregables |
| `automatizacion` | `n8n_bot` | `read`, `write`, `create` | Subida automática de reportes desde `n8n` (sin borrar ni re-compartir) |
| `auditores` | `auditor` | `read` | Consulta de documentación y evidencias en solo lectura |

## 5. Política de protección de secretos e integración con n8n
- **Prohibido almacenar secretos en Nextcloud**: no subir archivos `.env`, claves `JWT_SECRET`, dumps sin anonimizar ni tokens privados; solo plantillas (`.env.example`) y reportes sanitizados.
- **Endpoint WebDAV interno para `n8n`**:
  - URL base desde el contenedor `n8n`: `http://nextcloud/remote.php/dav/files/n8n_bot/Soderia-TP-Final/04-Reportes-n8n/`
  - Autenticación: credencial de `n8n_bot` configurada en las credenciales cifradas de `n8n` (no hardcodeada en el JSON del flujo).
