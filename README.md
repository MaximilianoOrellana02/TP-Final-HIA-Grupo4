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

## Modelo de datos

9 tablas: `usuarios`, `clientes`, `barrios`, `productos`, `historiales` (entregas), `historial_detalles`, `saldos_envase`, `movimientos_stock` y `repartos`.
