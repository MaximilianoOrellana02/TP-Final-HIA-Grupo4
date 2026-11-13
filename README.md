# TP Final HIA — Grupo 4: Sodería

Aplicación web para gestionar el reparto de una sodería: clientes por barrio, productos y stock, entregas, cobros y envases prestados.

## Estructura

| Carpeta | Contenido |
|---|---|
| `backend/` | API REST en Node.js + Express + TypeScript, con Sequelize y PostgreSQL |
| `frontend/` | Aplicación Angular servida por nginx |
| `cluster/` | Clúster PostgreSQL de alta disponibilidad: etcd + Patroni (3 nodos) + HAProxy + observabilidad |
| `docker-compose.yml` | Levanta **todo** el sistema (clúster, base de datos, backend, frontend y monitoreo) en un solo archivo |
| `datos/` | Persistencia local de pgAdmin y de los backups (bind mounts) |

## Cómo levantarlo

Requisitos: Docker Desktop.

1. Copiar `.env.example` como `.env` y completar las contraseñas y el `JWT_SECRET`.
   Sin `.env` el sistema también arranca: usa valores de desarrollo (`soderia` / `soderia_local`).
2. Levantar todo:

   ```bash
   docker compose up -d --build
   ```

3. Esperar el primer arranque (entre 1 y 2 minutos). El clúster se inicializa solo: etcd elige
   líder, Patroni crea la base `soderia` con el usuario y las réplicas se sincronizan. El backend
   no arranca hasta que HAProxy reporta un primario disponible.
4. Abrir http://localhost:8080

Para cargar datos de prueba (un admin, un repartidor, barrios, productos y clientes):

```bash
docker compose exec backend node scripts/datos-demo.js
```

El script muestra por consola las contraseñas generadas.

## Servicios

| Servicio | Imagen | Puerto expuesto |
|---|---|---|
| `etcd` | etcd 3.5 | ninguno (solo red interna) |
| `nodo1` / `nodo2` / `nodo3` | PostgreSQL 17 + Patroni | ninguno (5432 y 8008 solo internos) |
| `haproxy` | HAProxy | `7000` (estadísticas); `5432` **no** se publica al host |
| `backend` | Node 22 | ninguno (se accede por el frontend en `/api`) |
| `frontend` | nginx | `8080` |
| `pgadmin` | pgAdmin 4 | `5050` (solo en `127.0.0.1`) |
| `prometheus` | Prometheus | ninguno (solo red interna) |
| `grafana` | Grafana | `3000` |
| `postgres_exporter` | postgres-exporter | ninguno (solo red interna) |
| `cadvisor_monitor` | cAdvisor | ninguno (solo red interna) |

## Red y aislamiento

Todo el sistema comparte una única red bridge llamada **`red_cluster`**, definida en el
`docker-compose.yml` de la raíz. No hay archivos de Compose duplicados: el clúster y la
aplicación se declaran en el mismo archivo y se resuelven entre sí por nombre de servicio.

* El backend usa `DB_HOST=haproxy` y `DB_PORT=5432`: nunca habla con un nodo directo, siempre
  entra por el enrutador que apunta al líder.
* HAProxy conserva el alias de red `db` por compatibilidad con configuraciones viejas.
* `backend`, `pgadmin` y `backup` esperan a que HAProxy esté `healthy` (es decir, que vea un
  primario) antes de conectarse.
* Ningún servicio interno publica puertos: `etcd`, los tres nodos, `postgres_exporter`,
  `cadvisor_monitor` y `prometheus` solo son accesibles dentro de `red_cluster`.

| Recurso | URL |
|---|---|
| Frontend Sodería | <http://localhost:8080> |
| API a través de nginx | <http://localhost:8080/api/health> |
| Grafana | <http://localhost:3000> (admin / admin) |
| HAProxy Stats | <http://localhost:7000/> |
| pgAdmin | <http://127.0.0.1:5050> |
| Prometheus | solo interno: `http://prometheus:9090` dentro de `red_cluster` |
| PostgreSQL (HAProxy) | solo interno: `haproxy:5432` (o el alias `db:5432`) |

## Comprobar el clúster

```bash
docker exec postgres_nodo1 patronictl -c /etc/patroni/patroni.yml list
```

Debe mostrar un nodo `Leader` y dos `Replica`. El panel de HAProxy en
<http://localhost:7000/> confirma cuál está activo.

## Datos persistidos

Todos los datos se guardan con **bind mounts dentro del proyecto**:

| Ruta | Contenido |
|---|---|
| `cluster/datos_db/etcd_data` | estado del DCS |
| `cluster/datos_db/nodo1_data` | datos de PostgreSQL del nodo 1 |
| `cluster/datos_db/nodo2_data` | datos de PostgreSQL del nodo 2 |
| `cluster/datos_db/nodo3_data` | datos de PostgreSQL del nodo 3 |
| `cluster/observabilidad/prometheus_data` | serie temporal de métricas |
| `cluster/observabilidad/grafana_data` | usuarios y estado de Grafana |
| `datos/pgadmin` | servidores y conexiones de pgAdmin |
| `datos/backups` | archivos `.dump` del servicio `backup` |

Las carpetas de datos de ejecución (`cluster/datos_db/`, `grafana_data`, `prometheus_data` y
`datos/`) **no se versionan** (están en `.gitignore`). Los dashboards de Grafana sí se versionan
como JSON en `cluster/observabilidad/dashboards_json/` y se cargan automáticamente mediante
`cluster/observabilidad/grafana/provisioning/`, sin depender de `grafana.db`.

Para reiniciar el laboratorio desde cero, **parar primero** los contenedores y después borrar los
datos:

```bash
docker compose down
rm -rf cluster/datos_db/nodo1_data cluster/datos_db/nodo2_data cluster/datos_db/nodo3_data cluster/datos_db/etcd_data
docker compose up -d
```

No borres `datos_db` con los contenedores corriendo: etcd pierde su WAL, se cae y el clúster
queda sin líder.

## Backup y restauración de PostgreSQL

Para generar una copia bajo demanda, ejecutá desde la raíz del proyecto:

```bash
docker compose run --rm backup
```

El servicio imprime la ruta del archivo `.dump` y lo conserva en `datos/backups`.

Para probar la restauración, reemplazá `NOMBRE_DEL_ARCHIVO.dump` por el nombre que imprimió el servicio y usá un nombre de base nuevo en cada prueba:

```bash
docker compose run --rm backup 'createdb --maintenance-db=postgres soderia_restore && pg_restore --single-transaction --dbname=soderia_restore /backups/NOMBRE_DEL_ARCHIVO.dump'
```

Desde pgAdmin, actualizá la lista de bases y compará los datos de `clientes` e `historiales` entre la base original y la restaurada.

## Modelo de datos

9 tablas: `usuarios`, `clientes`, `barrios`, `productos`, `historiales` (entregas), `historial_detalles`, `saldos_envase`, `movimientos_stock` y `repartos`.
