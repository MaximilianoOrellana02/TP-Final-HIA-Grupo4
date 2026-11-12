# TP Final HIA — Grupo 4: Sodería

Aplicación web para gestionar el reparto de una sodería: clientes por barrio, productos y stock, entregas, cobros y envases prestados.

## Estructura

| Carpeta | Contenido |
|---|---|
| `backend/` | API REST en Node.js + Express + TypeScript, con Sequelize y PostgreSQL |
| `frontend/` | Aplicación Angular servida por nginx |
| `docker-compose.yml` | Levanta la base de datos, el backend y el frontend |

## Cómo levantarlo

Requisitos: Docker Desktop.

1. Copiar `.env.example` como `.env` y completar las contraseñas y el `JWT_SECRET`.
2. Levantar todo:

   ```bash
   docker compose up -d --build
   ```

3. Abrir http://localhost:8080

Al iniciar, el backend aplica las migraciones pendientes. Para cargar datos de prueba (un admin, un repartidor, barrios, productos y clientes):

```bash
docker compose exec backend node scripts/datos-demo.js
```

El script muestra por consola las contraseñas generadas.

## Servicios

| Servicio | Imagen | Puerto expuesto |
|---|---|---|
| `db` | PostgreSQL 17 | ninguno (solo red interna) |
| `backend` | Node 22 | ninguno (se accede por el frontend en `/api`) |
| `frontend` | nginx | `8080` |

## Backup y restauración de PostgreSQL

Para generar una copia bajo demanda, ejecutá desde la raíz del proyecto:

```bash
docker compose run --rm backup
```

El servicio imprime la ruta del archivo `.dump` y lo conserva en el volumen `pg_backups`.

Para probar la restauración, reemplazá `NOMBRE_DEL_ARCHIVO.dump` por el nombre que imprimió el servicio y usá un nombre de base nuevo en cada prueba:

```bash
docker compose run --rm backup 'createdb --maintenance-db=postgres soderia_restore && pg_restore --single-transaction --dbname=soderia_restore /backups/NOMBRE_DEL_ARCHIVO.dump'
```

Desde pgAdmin, actualizá la lista de bases y compará los datos de `clientes` e `historiales` entre la base original y la restaurada.

## Incidencias con MantisBT

MantisBT se inicia con el perfil `incidencias`. Utiliza una base MariaDB y un volumen propios (`mantis_db_data`); no se copian proyectos, cuentas ni incidencias de la instalación del TP6. PostgreSQL de Sodería permanece separado.

Completar en el `.env` local `MANTIS_DB_ROOT_PASSWORD`, `MANTIS_DB_PASSWORD` y `MANTIS_CRYPTO_SALT` con valores nuevos antes de iniciarlo. Para la instalación inicial, si Mantis solicita `/admin/install.php`, establecer temporalmente `MANTIS_ENABLE_ADMIN=1`; al terminar, volver a `0` y aplicar el cambio con el mismo comando:

```bash
docker compose --profile incidencias up -d mantisbt
```

Mantis se abre en `http://localhost:8989` y el correo de prueba en `http://localhost:8026`. Mailpit conserva los mensajes dentro del entorno local: las invitaciones y avisos no llegan a los correos reales de los integrantes. Para entregarlos, se pueden completar las variables `MANTIS_SMTP_*` y `MANTIS_FROM_EMAIL` del `.env` con un servidor de correo autorizado. Las cuentas, categorías e incidencias del punto 11 se crearán en esta instalación nueva.

## Modelo de datos

9 tablas: `usuarios`, `clientes`, `barrios`, `productos`, `historiales` (entregas), `historial_detalles`, `saldos_envase`, `movimientos_stock` y `repartos`.
