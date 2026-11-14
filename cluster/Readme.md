# Clúster PostgreSQL de Alta Disponibilidad con Patroni, etcd y HAProxy

* **Trabajo Práctico Nº 4 - Clúster**
* **Materia:** Herramientas Informáticas Avanzadas (2026)
* **Institución:** Facultad de Ingeniería – Universidad Nacional de Jujuy
* **Alumno:** Mendez Marcos Antonio (L.U.: 5276)
* **Carrera:** Analista Programador Universitario

---

## 1. Descripción de la Arquitectura

Este proyecto implementa una infraestructura contenerizada de base de datos relacional de alta disponibilidad, orientada a servicios financieros transaccionales.

La arquitectura está compuesta por los siguientes componentes:

* **Motor de Base de Datos:** PostgreSQL 17 desplegado en una topología de 3 nodos: 1 Primario/Líder y 2 Réplicas asíncronas mediante *Streaming Replication*.
* **Consenso Distribuido y Failover:** Patroni coordinado con un almacén de estado distribuido (`etcd`), permitiendo la elección automática de un nuevo líder y reduciendo el riesgo de escenarios de *Split-Brain*.
* **Enrutamiento y Balanceo:** HAProxy como punto de entrada único, expuesto en el puerto `5432`, encargado de redirigir el tráfico hacia el nodo líder.
* **Stack de Observabilidad:** Prometheus para la recolección de métricas, Grafana para la visualización y cAdvisor / Postgres Exporter para la telemetría de contenedores y base de datos.
* **Pruebas de Carga:** Pruebas de estrés y *benchmarking* transaccional mediante `pgbench`, utilizando el modelo TPC-B.

---

## 2. Requisitos Previos

Para ejecutar el proyecto se requiere:

* **Docker Engine** versión 20.10 o superior.
* **Docker Compose v2**.
* **Recursos mínimos recomendados:**

  * Procesador: 4 núcleos físicos / 8 hilos lógicos.
  * Memoria RAM: entre 6 GB y 8 GB libres.
  * Puertos locales libres:

    * `5432` → HAProxy (PostgreSQL).
    * `7000` → panel de estadísticas de HAProxy.
    * `3000` → Grafana.
    * `9090` → Prometheus.
    * `8080` → frontend de la Sodería.

---

## 3. Estructura del Repositorio

La raíz del proyecto debe mantener la siguiente organización (el compose es único y vive en la
raíz del repositorio):

```text
├── docker-compose.yml                  # Orquestación de TODOS los servicios
│
├── cluster/
│   ├── config/
│   │   └── haproxy.cfg                 # Configuración de balanceo y health checks
│   │
│   ├── datos_db/                       # Persistencia local (bind mounts)
│   │   ├── etcd_data/
│   │   ├── nodo1_data/
│   │   ├── nodo2_data/
│   │   └── nodo3_data/
│   │
│   ├── observabilidad/
│   │   ├── grafana_data/               # Persistencia de Grafana
│   │   ├── prometheus_data/            # Persistencia de Prometheus
│   │   ├── grafana/provisioning/       # Datasource Prometheus + dashboards
│   │   ├── dashboards_json/            # Dashboards en JSON
│   │   └── prometheus/
│   │       └── prometheus.yml          # Configuración de Prometheus
│   │
│   ├── scripts/
│   │   ├── Dockerfile                  # PostgreSQL 17 + Python + Patroni
│   │   ├── docker-entrypoint.sh        # Inicialización de los nodos
│   │   ├── post_bootstrap.sh           # Crea rol/base/pg_trgm en el bootstrap
│   │   └── patroni.yml                 # Configuración de Patroni
│   │
│   └── Readme.md                       # Este documento
│
├── datos/                              # Persistencia de pgAdmin y backups
│   ├── pgadmin/
│   └── backups/
│
├── backend/
└── frontend/
```

---

## 4. Despliegue de la Infraestructura

### Paso 1: Configurar permisos

Otorgar permisos de ejecución a los scripts de aprovisionamiento:

```bash
chmod +x scripts/*.sh
```

### Paso 2: Iniciar los contenedores

Desplegar todos los servicios en segundo plano. El comando se ejecuta **desde la raíz del
repositorio**, porque el compose único incluye la aplicación y el clúster:

```bash
docker compose up -d --build
```

> La red se llama **`red_cluster`**. Todos los servicios se ven entre sí por nombre
> (`haproxy`, `nodo1`, `postgres_exporter`, `prometheus`, etc.), sin publicar puertos
> internos al host.

### Paso 3: Verificar el estado del despliegue

Aguardar entre 15 y 30 segundos para permitir que `etcd` establezca el quórum y Patroni inicialice el nodo primario.

Verificar el estado de los contenedores:

```bash
docker compose ps
```

Para comprobar la topología del clúster y verificar qué nodo fue elegido como líder:

```bash
docker exec -it postgres_nodo1 patronictl -c /etc/patroni/patroni.yml list
```

---

## 5. Inicialización de la Base de Datos

El clúster cuenta internamente con los roles de administración `postgres` y `replicator`.

Además, el bootstrap de Patroni ejecuta `scripts/post_bootstrap.sh`, que crea automáticamente:

* Usuario: `soderia` (o el valor de `DB_USER`).
* Base: `soderia` (o el valor de `DB_NAME`).
* Extensión: `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm`).

Las credenciales se toman de `DB_NAME`, `DB_USER` y `DB_PASSWORD` del `.env` de la raíz. Si se
levanta solo la carpeta `cluster/`, se usan los valores por defecto `soderia` / `soderia_local`.
El backend aplica las migraciones de Sequelize al arrancar.

Verificación:

```bash
docker exec -it postgres_nodo1 psql -U postgres -c "\l"
docker exec -it postgres_nodo1 psql -U postgres -d soderia -c "\dx"
docker exec -it postgres_nodo1 psql -U postgres -d soderia -c "\dt"
```

### 5.1. Base opcional para pruebas con `pgbench`

Si se quieren repetir las pruebas de carga del TP, crear `banco_app` y `usuario_banco`:

```bash
docker exec -it postgres_nodo1 psql -U postgres -c "CREATE USER usuario_banco WITH ENCRYPTED PASSWORD 'clave123';"
docker exec -it postgres_nodo1 psql -U postgres -c "CREATE DATABASE banco_app OWNER usuario_banco;"
docker exec -it postgres_nodo1 psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE banco_app TO usuario_banco;"
docker exec -e PGPASSWORD=clave123 postgres_nodo1 pgbench -i -s 10 -h haproxy_router -p 5432 -U usuario_banco banco_app
```

---

## 6. Pruebas Funcionales y de Rendimiento

Todas las pruebas transaccionales se realizan a través de `haproxy_router` en el puerto `5432`, permitiendo validar el funcionamiento de la arquitectura distribuida.

### 6.1. Prueba Funcional — 10 Clientes

Se simulan 10 clientes concurrentes utilizando 2 hilos durante 10 segundos:

```bash
docker exec -e PGPASSWORD=clave123 postgres_nodo1 pgbench -c 10 -j 2 -T 10 -h haproxy_router -p 5432 -U usuario_banco banco_app
```

**Resultados de referencia:**

* Transacciones procesadas: **390**
* Fallos: **0.00 %**
* TPS: **39.20**
* Latencia promedio: **255.12 ms**

---

### 6.2. Prueba de Carga Media — 50 Clientes

Se simulan 50 clientes concurrentes utilizando 10 hilos durante 10 segundos:

```bash
docker exec -e PGPASSWORD=clave123 postgres_nodo1 pgbench -c 50 -j 10 -T 10 -h haproxy_router -p 5432 -U usuario_banco banco_app
```

**Resultados de referencia:**

* Transacciones procesadas: **294**
* Fallos: **0.00 %**
* TPS: **27.58**
* Latencia promedio: **1813.03 ms**

---

### 6.3. Prueba de Estrés — 70 Clientes

Se realiza una prueba de alta concurrencia con 70 clientes, utilizando 7 hilos durante 20 segundos, luego del ajuste de `max_connections`:

```bash
docker exec -e PGPASSWORD=clave123 postgres_nodo1 pgbench -c 70 -j 7 -T 20 -h haproxy_router -p 5432 -U usuario_banco banco_app
```

**Resultados de referencia:**

* Transacciones procesadas: **390**
* Fallos: **0.00 %**
* TPS: **16.59**
* Latencia promedio: **4.21 segundos**

---

## 7. Pruebas de Tolerancia a Fallos (*Failover*)

### Caso A: Caída forzada del Nodo Primario

1. En una primera terminal, ejecutar una prueba de estrés durante 30 segundos:

```bash
docker exec -e PGPASSWORD=clave123 postgres_nodo1 pgbench -c 50 -j 5 -T 30 -h haproxy_router -p 5432 -U usuario_banco banco_app
```

2. De forma simultánea, desde una segunda terminal, detener el contenedor del nodo líder:

```bash
docker stop postgres_nodo1
```

3. Comprobar el comportamiento del clúster.

Durante el proceso:

* Las transacciones activas pueden abortarse como consecuencia de la caída del nodo.
* Patroni y `etcd` realizan la elección de un nuevo líder entre los nodos disponibles.
* HAProxy actualiza el enrutamiento hacia el nuevo líder.

Comprobar el estado del clúster:

```bash
docker exec -it postgres_nodo2 patronictl -c /etc/patroni/patroni.yml list
```

---

### Caso B: Caída de una Réplica Secundaria

1. Detener una réplica mientras el resto del clúster continúa operativo:

```bash
docker stop postgres_nodo3
```

2. Ejecutar una prueba sobre el nodo activo a través de HAProxy:

```bash
docker exec -e PGPASSWORD=clave123 postgres_nodo2 pgbench -c 20 -j 2 -T 10 -h haproxy_router -p 5432 -U usuario_banco banco_app
```

3. Comprobar el funcionamiento del clúster.

La pérdida de una réplica secundaria no debería impedir la continuidad del servicio de escritura mientras exista un líder disponible.

---

### Caso C: Reincorporación del Nodo Recuperado

Reiniciar el nodo detenido:

```bash
docker start postgres_nodo1
```

Una vez iniciado, el nodo vuelve a conectarse al clúster y, según el estado de la replicación, sincroniza los cambios pendientes para reincorporarse como réplica secundaria.

---

## 8. Monitoreo y Observabilidad

| Componente        | Dirección / Acceso                        | Función                                          |
| ----------------- | ----------------------------------------- | ------------------------------------------------ |
| **Grafana**       | `http://localhost:3000`                   | Visualización de métricas y dashboards           |
| **HAProxy Stats** | `http://localhost:7000/`                  | Estado de los backends y comprobaciones de salud |
| **Prometheus**    | `http://prometheus:9090` (solo interno)   | Recolección de métricas                          |
| **Patroni API**   | Puerto `8008`                             | Estado y health checks de los nodos              |

### Grafana

Acceso:

```text
http://localhost:3000
```

Credenciales utilizadas en el entorno:

```text
Usuario: admin
Contraseña: admin
```

Los dashboards se provisionan automáticamente desde `observabilidad/dashboards_json/`
(carpeta **Sodería / Clúster**): el de **Ciclo de Vida / Failover** y el de
**Observabilidad Integral** de 12 paneles. Los JSON también se pueden importar a mano
desde la UI de Grafana. Para el detalle completo, ver
[`MANUAL_IMPLEMENTACION_CLUSTER.md`](../MANUAL_IMPLEMENTACION_CLUSTER.md).

### HAProxy Stats

Acceso:

```text
http://localhost:7000/
```

Permite consultar en tiempo real el estado de `nodo1`, `nodo2` y `nodo3` (columna *Status*),
cuál está como primario y las comprobaciones de salud de Patroni.

### Prometheus

Prometheus ya no se publica al host: vive en la red `red_cluster` y se resuelve como
`prometheus:9090` para Grafana. Su función principal es recolectar cada 2 segundos las métricas de
`prometheus`, `postgres_exporter`, `cadvisor` y de la API de Patroni de los tres nodos.

---

## 9. Detención y Limpieza del Entorno

### Detener los servicios conservando los datos

Para detener la infraestructura sin eliminar los datos persistidos (desde la raíz del proyecto):

```bash
docker compose down
```

### Reiniciar el laboratorio desde cero

Para eliminar los contenedores y redes y limpiar los datos persistidos en los *bind mounts*
(desde la raíz del proyecto):

```bash
docker compose down

rm -rf cluster/datos_db/nodo1_data cluster/datos_db/nodo2_data cluster/datos_db/nodo3_data cluster/datos_db/etcd_data
```

> **Importante:** parar los contenedores **antes** de borrar `datos_db`. Si se borra el
> directorio mientras etcd o PostgreSQL están corriendo, etcd muere al no poder purgar su
> WAL y el clúster queda sin líder (HAProxy devuelve 503 en los tres nodos).
>
> `datos_db/` no se versiona (está en `.gitignore`): son datos de ejecución que el clúster
> reconstruye solo en el primer arranque. Los datos de la aplicación se cargan después con
> `docker compose exec backend node scripts/datos-demo.js`.

> **Advertencia:** Este último procedimiento elimina los datos persistidos del laboratorio. Utilizarlo únicamente cuando se quiera realizar una instalación completamente limpia.

---

## 10. Resumen de la Arquitectura

La infraestructura implementada utiliza los siguientes componentes:

```text
                         CLIENTES
                            │
                            │ PostgreSQL :5432
                            ▼
                    ┌─────────────────┐
                    │     HAProxy     │
                    │   Router :5432  │
                    └────────┬────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
                  ▼                     ▼
          ┌───────────────┐      ┌───────────────┐
          │ PostgreSQL    │      │ PostgreSQL    │
          │ Nodo 1        │◄────►│ Nodo 2        │
          │   LÍDER       │      │   RÉPLICA     │
          └───────┬───────┘      └───────┬───────┘
                  │                       │
                  │       Replicación     │
                  └───────────┬───────────┘
                              │
                              ▼
                     ┌───────────────┐
                     │ PostgreSQL    │
                     │ Nodo 3        │
                     │   RÉPLICA     │
                     └───────────────┘


              ┌─────────────────────────┐
              │          etcd           │
              │ Estado distribuido /    │
              │ coordinación del cluster│
              └────────────┬────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │         Patroni         │
              │ Failover y gestión HA   │
              └─────────────────────────┘


        ┌──────────────────────────────────────┐
        │          OBSERVABILIDAD              │
        │                                      │
        │ Prometheus → Métricas                │
        │ Grafana    → Dashboards              │
        │ cAdvisor   → Métricas de contenedores│
        │ PG Exporter → Métricas PostgreSQL    │
        └──────────────────────────────────────┘
```

---

## 11. Tecnologías Utilizadas

| Tecnología            | Uso                                       |
| --------------------- | ----------------------------------------- |
| **Docker**            | Contenerización de los servicios          |
| **Docker Compose**    | Orquestación de la infraestructura        |
| **PostgreSQL 17**     | Sistema gestor de base de datos           |
| **Patroni**           | Gestión de alta disponibilidad y failover |
| **etcd**              | Almacenamiento distribuido y coordinación |
| **HAProxy**           | Balanceo y enrutamiento del tráfico       |
| **Prometheus**        | Recolección de métricas                   |
| **Grafana**           | Visualización y monitoreo                 |
| **cAdvisor**          | Métricas de contenedores                  |
| **Postgres Exporter** | Métricas de PostgreSQL                    |
| **pgbench**           | Pruebas de rendimiento y carga            |

---

## 12. Integración con la aplicación Sodería

Todo el sistema (aplicación + clúster + observabilidad) se define en un único
`docker-compose.yml` en la raíz del repositorio. Ya no existe un compose separado dentro de
`cluster/`: sus servicios se declaran en el archivo raíz apuntando a `./cluster/...`.

* `backend`, `frontend`, `pgadmin` y `backup` conviven con `etcd`, `nodo1`, `nodo2`, `nodo3`,
  `haproxy`, `postgres_exporter`, `cadvisor_monitor`, `prometheus` y `grafana`.
* La red única es **`red_cluster`** (bridge); todos los servicios se resuelven por nombre.
* `backend` usa `DB_HOST=haproxy` y `DB_PORT=5432`; nunca habla con un nodo directo.
* `haproxy` tiene el alias de red `db`, por compatibilidad con configuraciones viejas.
* `backend`, `pgadmin` y `backup` esperan a que `haproxy` esté `healthy` antes de conectarse.
  El healthcheck exige que HAProxy vea al menos un primario (`postgres_back,BACKEND ... UP`).
* Solo se publican al host el frontend (`8080`), Grafana (`3000`), las estadísticas de HAProxy
  (`7000`) y pgAdmin (`127.0.0.1:5050`). El puerto `5432` de HAProxy está comentado a propósito:
  la base de datos no queda expuesta.

Comando único desde la raíz del repositorio:

```bash
docker compose up -d --build
```

| Servicio | URL |
|---|---|
| Frontend Sodería | <http://localhost:8080> |
| API a través de nginx | <http://localhost:8080/api/health> |
| Grafana | <http://localhost:3000> (admin / admin) |
| HAProxy Stats | <http://localhost:7000/> |
| pgAdmin | <http://127.0.0.1:5050> |
| Prometheus | solo interno: `http://prometheus:9090` |
| PostgreSQL (HAProxy) | solo interno: `haproxy:5432` (o `db:5432`) |

Para conectarse con un cliente SQL local (por ejemplo `psql` o DBeaver) hay que descomentar
temporalmente `- "5432:5432"` en el servicio `haproxy` y volver a ejecutar `docker compose up -d`.
En el despliegue normal la base solo es accesible desde `red_cluster`.
