# Mejoras de Seguridad Pendientes de Implementación — Proyecto Sodería

Este documento registra los controles técnicos que fueron evaluados durante la auditoría de seguridad y quedaron planificados como mejoras pendientes (no aplicadas en el *hardening* inicial para mantener el alcance acotado y evitar modificaciones innecesarias sobre servicios deshabilitados o flujos de integración).

## 1. Seguridad de la Aplicación (Backend y Proxy)

### 1.1. Middleware `helmet` en Express (`backend/src/app.ts`)
* **Pendiente:** Incorporar el paquete `helmet` en el backend Node.js/Express para gestionar automáticamente un conjunto completo de cabeceras de seguridad HTTP (`Content-Security-Policy`, `Cross-Origin-Opener-Policy`, `Strict-Transport-Security`, `X-DNS-Prefetch-Control`, etc.) directamente desde la capa de aplicación, complementando las cabeceras básicas ya configuradas en Nginx (`X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`).

### 1.2. Limitación de Ráfagas y Conexiones en Nginx (`frontend/nginx.conf`)
* **Pendiente:** Implementar zonas de control de tasa y concurrencia directamente en Nginx mediante `limit_req_zone` y `limit_conn_zone` para absorber ráfagas DDoS en el borde antes de que las peticiones alcancen el contenedor `backend`.

### 1.3. Protección Criptográfica de Webhooks (Mercado Pago y n8n)
* **Pendiente:**
  * **Validación de firma HMAC (`x-signature`):** Implementar la verificación criptográfica de autenticidad en los endpoints de webhook de Mercado Pago (actualmente deshabilitado en configuración) para evitar falsificación de notificaciones de pago.
  * **Tokens secretos y anti-replay en n8n:** Exigir un token secreto compartido en las cabeceras de webhooks invocados desde flujos automatizados en **n8n** y registrar identificadores de evento para rechazar *replay attacks*.

### 1.4. Auditoría Exhaustiva de Autorización (IDOR / BOLA)
* **Pendiente:** Realizar una revisión completa de todas las rutas de `backend/src/routes/` para verificar que cada endpoint crítico (eliminación o restauración de clientes, modificación de precios, ajustes de stock y gestión de usuarios) valide explícitamente el rol `soloAdmin` frente al rol `repartidor`.

## 2. Seguridad de Contenedores y Backups

### 2.1. Autenticación en el Panel de Estadísticas de HAProxy (`cluster/config/haproxy.cfg`)
* **Pendiente:** Aunque el puerto `7000` ya fue restringido a la interfaz local (`127.0.0.1:7000:7000`), queda pendiente agregar autenticación básica (`stats auth`) en `haproxy.cfg` como segunda capa de defensa.

### 2.2. Integridad SHA-256 y Cifrado en el Servicio de Backup (`docker-compose.yml`)
* **Pendiente:**
  * **Verificación de integridad:** Modificar el script del servicio `backup` para generar automáticamente un archivo `.sha256` (`sha256sum`) junto a cada volcado `.dump`, permitiendo detectar corrupción o alteración por *ransomware* antes de restaurar.
  * **Cifrado simétrico en reposo:** Incorporar cifrado **AES-256** (mediante OpenSSL o GPG) sobre los archivos de respaldo y aplicar la estrategia **3-2-1** con almacenamiento externo inmutable.

## 3. Seguridad en CI/CD, Cadena de Suministro y Sistemas de IA

### 3.1. Controles en el Pipeline `.github/workflows/ci-cd.yml`
* **Pendiente:**
  * **Auditoría de dependencias:** Agregar un paso automatizado con `npm audit --audit-level=high` en `backend` y `frontend` dentro del flujo de GitHub Actions.
  * **Escaneo de contenedores y SBOM:** Integrar **Trivy** (`aquasecurity/trivy-action`) en el pipeline para analizar vulnerabilidades en imágenes Docker y dependencias del sistema de archivos.
  * **Fijación por Digest SHA-256:** Reemplazar etiquetas mutables (`:latest` / `:develop`) por identificadores inmutables `@sha256:...` en las imágenes base críticas (tal como se aplicó en los servicios auxiliares `mantis-db`, `mantisbt` y `mantis-correo`) y evaluar los riesgos de actualización automática con Watchtower.

### 3.2. Riesgos y Reglas de Prevención en Sistemas de IA
* **Pendiente (Formalización de políticas de uso):**
  * **Alucinación de paquetes (*Slopsquatting*):** Verificar siempre en el registro oficial de npm cualquier paquete sugerido por LLMs y utilizar `npm ci` para evitar instalaciones no auditadas.
  * **Fuga de secretos y datos sensibles:** Prohibir el envío de archivos `.env`, claves `JWT_SECRET` o datos reales de clientes de la Sodería en prompts de asistentes externos.
  * **Inyección de Prompts (*Prompt Injection*):** Sanitizar entradas de texto provenientes de usuarios o tickets antes de procesarlas en flujos automatizados con agentes LLM o **n8n**.