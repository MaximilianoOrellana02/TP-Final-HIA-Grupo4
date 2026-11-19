# Informe Técnico: Hardening y Seguridad Informática — Proyecto Sodería

## 1. Introducción y Enfoque de Defensa en Profundidad

La arquitectura de **Sodería** implementa un esquema de **defensa en profundidad** estructurado en dos capas complementarias que protegen el sistema sin afectar la alta disponibilidad del clúster PostgreSQL ni la operación del frontend:

1. **Capa de Borde y Aplicación (`Nginx` + `Express`):** El contenedor `frontend` actúa como único punto de entrada HTTP público (`:8080`), aplicando endurecimiento de cabeceras, ocultamiento de versión, límites de tamaño de cuerpo y tiempos de espera cortos antes de reenviar el tráfico de negocio hacia `/api/`. En el nivel interno, la API REST en Node.js/Express valida el origen real de cada cliente detrás del proxy, restringe el volumen de payloads JSON y aplica controles de tasa (*rate limiting*) por dirección IP para mitigar abusos automatizados y denegación de servicio en capa 7 (DDoS L7).
2. **Capa de Infraestructura y Contenedores (`Docker Compose` + `Patroni` + `HAProxy`):** Todos los servicios de datos (`etcd`, `nodo1`, `nodo2`, `nodo3`), balanceo SQL (`haproxy:5432`) y recolección de métricas (`prometheus`, `postgres_exporter`, `cadvisor_monitor`) permanecen aislados dentro de la red bridge privada `red_cluster` sin publicar puertos de base de datos al sistema anfitrión. Las credenciales críticas del clúster se parametrizan mediante variables de entorno, los paneles administrativos se restringen a la interfaz de loopback (`127.0.0.1`) y los contenedores de borde y aplicación se ejecutan con bloqueo explícito de escalada de privilegios (`no-new-privileges:true`).

---

## 2. Protección contra DDoS (Capa 7), Cabeceras HTTP y Abuso de Tráfico

### 2.1. Hardening en el Proxy Inverso (`frontend/nginx.conf`)

En el servidor Nginx que sirve la aplicación Angular y actúa como proxy inverso hacia el backend (`http://backend:3001`), se aplicaron las siguientes directivas de seguridad:

* **Ocultamiento de firma y versión (`server_tokens off;`):** Suprime el número de versión de Nginx en la cabecera `Server` y en las páginas de error por defecto, dificultando el reconocimiento automatizado de vulnerabilidades específicas de versión (*banner grabbing*).
* **Cabeceras de seguridad HTTP activas (`always`):**
  * `X-Content-Type-Options: nosniff`: Impide que el navegador realice *MIME-sniffing* e interprete respuestas con un tipo de contenido distinto al declarado.
  * `X-Frame-Options: SAMEORIGIN`: Mitiga ataques de *Clickjacking* bloqueando la incrustación de la interfaz en `<frame>` o `<iframe>` de dominios externos.
  * `Referrer-Policy: strict-origin-when-cross-origin`: Evita la filtración de rutas o parámetros internos en la cabecera `Referer` hacia orígenes externos.
* **Protección contra saturación de ancho de banda y ataques *Slowloris*:**
  * `client_max_body_size 1m;`: Rechaza en el borde cualquier petición HTTP cuyo cuerpo supere 1 MB antes de que consuma memoria en el proceso Node.js.
  * `client_body_timeout 10s;`, `client_header_timeout 10s;` y `send_timeout 10s;`: Cierran conexiones lentas o incompletas que intenten agotar los *workers* del servidor manteniendo sockets abiertos indefinidamente.

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Hardening: ocultar versión de Nginx y proteger contra payloads grandes / Slowloris
    server_tokens off;
    client_max_body_size 1m;
    client_body_timeout 10s;
    client_header_timeout 10s;
    send_timeout 10s;

    # Cabeceras HTTP de seguridad
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # DNS interno de Docker: re-resuelve `backend` si Watchtower lo recrea con otra IP
    resolver 127.0.0.11 valid=10s ipv6=off;

    # API -> contenedor backend (red interna de Docker)
    location /api/ {
        set $backend_upstream http://backend:3001;
        proxy_pass $backend_upstream;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Nunca cachear index.html para ver despliegues nuevos de Watchtower al instante
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    # SPA: cualquier ruta desconocida devuelve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 2.2. Hardening en la API REST (`backend/src/app.ts`)

En el punto de entrada de Express se reforzó el procesamiento de peticiones entrantes sin añadir dependencias externas nuevas, reutilizando `express-rate-limit`:

* **Ocultamiento de tecnología del backend (`app.disable("x-powered-by")`):** Elimina la cabecera `X-Powered-By: Express` en todas las respuestas de la API.
* **Resolución de IP real detrás de proxy (`app.set("trust proxy", 1)`):** Permite que Express tome la dirección IP del cliente desde `X-Forwarded-For` enviada por el primer salto de confianza (el contenedor `frontend` con Nginx). Esto evita que el limitador de tasa identifique erróneamente la IP interna del contenedor Nginx como único origen y bloquee a todos los usuarios.
* **Límite estricto del payload JSON (`express.json({ limit: "100kb" })`):** Frena ataques de agotamiento de memoria y CPU por parseo de objetos JSON masivos (`HTTP 413 Payload Too Large`).
* **Limitación de tasa global (`apiRateLimiter`):** Se aplica sobre el prefijo `/api` con un umbral de **120 peticiones por minuto por IP**, devolviendo cabeceras estándar (`draft-8`) y mensaje controlado (`HTTP 429 Too Many Requests`), conviviendo con los limitadores específicos más estrictos ya presentes en `/api/usuarios` (`/login`, `/registro`, `/recuperar`, `/restablecer` y `/password`).

```typescript
const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

const origenesPermitidos = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : true;

app.use(cors({ origin: origenesPermitidos }));

app.use(express.json({ limit: "100kb" }));

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Intenta nuevamente mas tarde." },
});

app.use("/api", apiRateLimiter);
```

---

## 3. Aseguramiento de Credenciales y Hardening de Contenedores

### 3.1. Parametrización de Secretos (`docker-compose.yml` y `.env.example`)

Se eliminaron las contraseñas en texto plano que estaban fijadas directamente en las definiciones de `nodo1`, `nodo2` y `nodo3` dentro de `docker-compose.yml` (`root` para el superusuario de PostgreSQL/Patroni y `rep_pass` para el usuario de replicación). En su lugar, se parametrizaron mediante interpolación de variables con valores por defecto de desarrollo para no romper el arranque local:

* `PATRONI_POSTGRESQL_AUTHENTICATION_SUPERUSER_PASSWORD=${PATRONI_SUPERUSER_PASSWORD:-root}`
* `PATRONI_SUPERUSER_PASSWORD=${PATRONI_SUPERUSER_PASSWORD:-root}`
* `PATRONI_POSTGRESQL_AUTHENTICATION_REPLICATION_PASSWORD=${PATRONI_REPLICATION_PASSWORD:-rep_pass}`
* `PATRONI_REPLICATION_PASSWORD=${PATRONI_REPLICATION_PASSWORD:-rep_pass}`

Ambas variables quedaron documentadas en la plantilla versionada `.env.example` sin exponer secretos reales en el repositorio Git:

```dotenv
# ---------- Base de datos (PostgreSQL / Patroni) ----------
DB_NAME=soderia
DB_USER=soderia
DB_PASSWORD=cambiar
PATRONI_SUPERUSER_PASSWORD=cambiar_superuser_password
PATRONI_REPLICATION_PASSWORD=cambiar_replication_password
```

### 3.2. Reducción de Superficie de Ataque y Privilegios

* **Aislamiento en loopback del panel de HAProxy (`127.0.0.1:7000:7000`):** El puerto `7000` de estadísticas de HAProxy dejó de publicarse en todas las interfaces de red (`0.0.0.0:7000`) y quedó restringido exclusivamente a `127.0.0.1:7000:7000`, siguiendo el mismo criterio aplicado a `pgadmin` (`127.0.0.1:5050:80`), `mantisbt` (`127.0.0.1:8989:80`) y `n8n` (`127.0.0.1:5678:5678`).
* **Bloqueo de escalada de privilegios (`no-new-privileges:true`):** Se incorporó `security_opt: ["no-new-privileges:true"]` en los servicios `backend`, `frontend` y `haproxy`, impidiendo que cualquier proceso dentro de esos contenedores adquiera privilegios adicionales mediante binarios `setuid`/`setgid`. Los nodos de base de datos (`nodo1..3`) y `cadvisor_monitor` se mantuvieron sin esta restricción para preservar la inicialización del motor PostgreSQL/Patroni y la lectura de métricas del kernel.

### 3.3. Resumen de Controles Implementados

| Control de Seguridad | Archivo Modificado | Configuración Aplicada | Amenaza Mitigada |
| :--- | :--- | :--- | :--- |
| **Ocultamiento de versión web** | `frontend/nginx.conf` | `server_tokens off;` | Reconocimiento y *fingerprinting* de versión de Nginx. |
| **Cabeceras de seguridad HTTP** | `frontend/nginx.conf` | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | *MIME-sniffing*, *Clickjacking* y fuga de URLs internas. |
| **Límites de cuerpo y timeouts** | `frontend/nginx.conf` | `client_max_body_size 1m;` y timeouts de `10s` | Ataques DDoS de agotamiento de conexiones (*Slowloris*). |
| **Ocultamiento de firma API** | `backend/src/app.ts` | `app.disable("x-powered-by");` | Identificación automatizada del stack Express. |
| **Confianza en proxy inverso** | `backend/src/app.ts` | `app.set("trust proxy", 1);` | Falsificación de IP o bloqueo global del proxy en rate-limiting. |
| **Límite de payload JSON** | `backend/src/app.ts` | `express.json({ limit: "100kb" })` | Denegación de servicio (DoS) por payloads JSON gigantes. |
| **Rate Limiting global de API** | `backend/src/app.ts` | `120 req/min` por IP en `/api` (`express-rate-limit`) | DDoS de capa 7, *scraping* masivo y abuso de endpoints REST. |
| **Parametrización de secretos** | `docker-compose.yml` / `.env.example` | `${PATRONI_SUPERUSER_PASSWORD:-root}` y `${PATRONI_REPLICATION_PASSWORD:-rep_pass}` | Exposición de credenciales críticas del clúster en código fuente. |
| **Restricción de puerto HAProxy** | `docker-compose.yml` | `"127.0.0.1:7000:7000"` | Exposición de topología y telemetría del balanceador en red LAN/WAN. |
| **Restricción de privilegios** | `docker-compose.yml` | `security_opt: ["no-new-privileges:true"]` en `backend`, `frontend`, `haproxy` | Escalada de privilegios dentro del contenedor en caso de compromiso. |

---

## 4. Validación Técnica y Verificación

### 4.1. Resultados de Validación Estática y Compilación

Se verificó la integridad de la configuración del stack y la compilación estricta del backend tras aplicar los cambios:

* **Validación de sintaxis e interpolación de Docker Compose:**
  * Comando ejecutado: `docker compose config --quiet`
  * Resultado: **Código de salida `0`** (interpolación válida de variables de entorno, perfiles, redes y opciones `security_opt`).
* **Verificación de tipos y compilación TypeScript en Node 22 Alpine:**
  * Comando ejecutado: `npx tsc --noEmit` y `npm run build` (`tsc`) dentro de la etapa de construcción de `backend/Dockerfile`.
  * Resultado: **Código de salida `0`** sin errores de tipos ni advertencias de compilación.

### 4.2. Comandos Rápidos de Verificación en Ejecución

Con el entorno levantado (`docker compose up -d --build`), se pueden comprobar las medidas implementadas mediante los siguientes comandos:

1. **Verificar cabeceras HTTP de seguridad y ausencia de versión en Nginx y Express:**

   ```bash
   curl -I http://localhost:8080/
   curl -I http://localhost:8080/api/health
   ```

   *Resultado esperado:* Presencia de `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, cabecera `Server: nginx` sin número de versión, ausencia de `X-Powered-By` y presencia de cabeceras `RateLimit-*` en `/api/health`.

2. **Verificar rechazo de payload JSON superior a `100kb` (`HTTP 413`):**

   ```bash
   python -c "print('{\"x\":\"' + 'a'*120000 + '\"}')" | curl -i -X POST http://localhost:8080/api/usuarios/login -H "Content-Type: application/json" -d @-
   ```

3. **Verificar que el panel de HAProxy (`:7000`) escucha únicamente en loopback (`127.0.0.1`) y que PostgreSQL (`:5432`) no está expuesto al host:**

   ```bash
   docker compose ps --format "table {{.Name}}\t{{.Ports}}"
   ```
