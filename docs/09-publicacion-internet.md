# Punto 9: Publicación y Acceso Seguro desde Internet

## 1. Estrategia de Publicación

La aplicación **Sodería** se publica de forma controlada mediante **Tailscale** (red privada sobre WireGuard + HTTPS administrado en borde), evitando abrir puertos directamente en el router doméstico/institucional (`port forwarding`) y manteniendo aislados los servicios internos.

## 2. Exposición de Servicios y Control de Acceso

| Servicio | Puerto Local en Host | Modo de Exposición | Alcance |
| :--- | :--- | :--- | :--- |
| **Aplicación Web (`frontend` / Nginx)** | `8080` (`0.0.0.0:8080->80`) | **Tailscale Funnel** (`https://maxy.tailafb40d.ts.net/`) | Acceso público HTTPS hacia el frontend y `/api/*` |
| **pgAdmin** | `127.0.0.1:5050` | **Tailscale Serve** (`https://maxy.tailafb40d.ts.net:8443`) | Solo integrantes dentro de la **tailnet** (no público) |
| **HAProxy Stats / Grafana / Prometheus / Mantis / n8n / Nextcloud** | `127.0.0.1:*` | Solo loopback local | Administración exclusiva desde el host |
| **PostgreSQL (`nodo1..3`, `haproxy:5432`) / `etcd`** | Sin publicar | Solo red interna `red_cluster` | Inaccesibles desde el host e Internet |

## 3. Flujo de Tráfico y Seguridad en el Borde

1. El cliente externo accede por HTTPS a `https://maxy.tailafb40d.ts.net/`.
2. Tailscale termina TLS automáticamente y reenvía las peticiones por el túnel hacia `http://127.0.0.1:8080` (`soderia-frontend-1`).
3. Nginx sirve la SPA Angular (sin exponer puertos del backend) y reenvía `/api/*` internamente por `red_cluster` hacia `http://backend:3001`, preservando `X-Forwarded-For` y `X-Real-IP`.
4. Express (`app.set("trust proxy", 1)`) lee la IP de origen detrás del proxy para aplicar el límite de tasa (`express-rate-limit`) y autenticación JWT sin bloquear globalmente al proxy.

## 4. Comandos de Operación y Verificación

- **Publicar frontend públicamente por HTTPS (Funnel):**
  ```powershell
  tailscale funnel --bg 8080
  ```
- **Publicar pgAdmin solo para la tailnet (Serve en `:8443`):**
  ```powershell
  tailscale serve --bg --https=8443 5050
  ```
- **Consultar estado activo del túnel y reglas:**
  ```powershell
  tailscale status
  tailscale funnel status
  ```
- **Cortar exposición pública inmediata (contención):**
  ```powershell
  tailscale funnel --https=443 off
  ```
