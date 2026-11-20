# Informe Técnico: Arquitectura de Alta Disponibilidad (HA) y Observabilidad — Proyecto Sodería

## 1. Diagrama de Replicación y Arquitectura de Red

La infraestructura de persistencia de **Sodería** se despliega sobre una red privada de Docker (`soderia_red_cluster`) donde ningún nodo de base de datos ni servicio interno expone puertos directamente al sistema anfitrión. El tráfico de la aplicación ingresa exclusivamente a través del balanceador **HAProxy**, el cual enruta las peticiones hacia el único nodo **Líder (Primario)** autorizado por consenso distribuido.

```mermaid
flowchart TB
    subgraph Host ["Host / Exterior (Puertos Expuestos)"]
        Browser["Navegador Web<br/>(Admin / Repartidor)"]
        GrafanaUI["Grafana UI<br/>(:3000)"]
        HAProxyUI["HAProxy Stats<br/>(:7000)"]
    end

    subgraph Net ["Red Privada Docker: soderia_red_cluster"]
        FE["Frontend Angular<br/>(Nginx :8080)"]
        BE["Backend Node.js / Express<br/>(Sequelize ORM)"]
        HAP["HAProxy Router<br/>(Alias: db:5432)"]
        
        subgraph Cluster ["Clúster PostgreSQL 17 + Patroni"]
            N1["nodo1<br/>PG 17 + Patroni (:8008)<br/>[LÍDER / PRIMARY]"]
            N2["nodo2<br/>PG 17 + Patroni (:8008)<br/>[RÉPLICA / STANDBY]"]
            N3["nodo3<br/>PG 17 + Patroni (:8008)<br/>[RÉPLICA / STANDBY]"]
        end

        ETCD["etcd Consensus<br/>(DCS :2379)"]
        
        subgraph Obs ["Stack de Observabilidad"]
            PGEXP["postgres_exporter<br/>(:9187)"]
            CADV["cAdvisor<br/>(:8080)"]
            PROM["Prometheus<br/>(:9090)"]
            GRAF["Grafana<br/>(:3000)"]
        end
    end

    Browser -->|:8080| FE
    FE -->|Proxy /api| BE
    BE -->|SQL TCP db:5432| HAP
    HAProxyUI -.->|:7000| HAP

    HAP -->|Check GET /primary :8008<br/>Enruta 100% SQL (200 OK)| N1
    HAP -.->|Check :8008 (503 DOWN)| N2
    HAP -.->|Check :8008 (503 DOWN)| N3

    N1 == "Streaming Replication (WAL)" ==> N2
    N1 == "Streaming Replication (WAL)" ==> N3

    N1 <-->|TTL Leader Lock| ETCD
    N2 <-->|Watch / Elección| ETCD
    N3 <-->|Watch / Elección| ETCD

    PGEXP -->|Métricas SQL| HAP
    PROM -->|Scrape 2s (:8008)| N1 & N2 & N3
    PROM -->|Scrape 15s| PGEXP & CADV
    GRAF -->|PromQL| PROM
    GrafanaUI -->|:3000| GRAF
```

### Flujo de Operación
1. **Punto Único de Entrada:** El contenedor `backend` se conecta al host `db:5432`, resuelto internamente mediante un alias de red hacia `haproxy_router`.
2. **Enrutamiento Inteligente:** HAProxy verifica cada pocos segundos el endpoint `GET /primary` en el puerto `8008` de cada nodo. Únicamente el nodo que posee el liderazgo responde `HTTP 200 OK` y recibe las operaciones de lectura y escritura; las réplicas responden `HTTP 503` y quedan bloqueadas en el pool de escritura.
3. **Replicación Continua:** El nodo Líder transmite en tiempo real los registros de transacciones (*Write-Ahead Logging* — WAL) mediante *Streaming Replication* hacia las dos réplicas.

---

## 2. Configuraciones de los Nodos

El clúster está compuesto por tres instancias homogéneas de **PostgreSQL 17** administradas por **Patroni**, coordinadas por **etcd** bajo el ámbito (`scope`) `cluster_bancario`.

### 2.1. Tabla Comparativa de Nodos y Servicios

| Componente | Contenedor | Dirección Interna | Rol y Función Principal | Persistencia en Disco |
| :--- | :--- | :--- | :--- | :--- |
| **Consenso (DCS)** | `etcd_cerebro` | `etcd:2379` | Almacén clave-valor distribuido; gestiona la llave de liderazgo con TTL. | `./cluster/datos_db/etcd_data` |
| **Nodo 1** | `postgres_nodo1` | `nodo1:5432` / `nodo1:8008` | Instancia PostgreSQL 17 + API REST y métricas de Patroni. | `./cluster/datos_db/nodo1_data` |
| **Nodo 2** | `postgres_nodo2` | `nodo2:5432` / `nodo2:8008` | Instancia PostgreSQL 17 + API REST y métricas de Patroni. | `./cluster/datos_db/nodo2_data` |
| **Nodo 3** | `postgres_nodo3` | `nodo3:5432` / `nodo3:8008` | Instancia PostgreSQL 17 + API REST y métricas de Patroni. | `./cluster/datos_db/nodo3_data` |
| **Balanceador** | `haproxy_router` | `haproxy:5432` (alias `db`) | Enruta conexiones SQL al Primario activo y expone panel en `:7000`. | Stateless (`haproxy.cfg`) |

### 2.2. Parámetros Clave de Patroni (`docker-compose.yml`)
Cada nodo recibe su identidad, credenciales de replicación y referencia al almacén de consenso mediante variables de entorno:

```yaml
environment:
  - PATRONI_NAME=nodo1
  - PATRONI_SCOPE=cluster_bancario
  - PATRONI_ETCD3_HOSTS=etcd:2379
  - PATRONI_RESTAPI_LISTEN=0.0.0.0:8008
  - PATRONI_RESTAPI_CONNECT_ADDRESS=nodo1:8008
  - PATRONI_POSTGRESQL_LISTEN=0.0.0.0:5432
  - PATRONI_POSTGRESQL_CONNECT_ADDRESS=nodo1:5432
  - PATRONI_POSTGRESQL_DATA_DIR=/var/lib/postgresql/data
  - PATRONI_POSTGRESQL_BIN_DIR=/usr/lib/postgresql/17/bin
  - PATRONI_REPLICATION_USERNAME=replicator
  - PATRONI_REPLICATION_PASSWORD=rep_pass
```

### 2.3. Configuración de Enrutamiento en HAProxy (`cluster/config/haproxy.cfg`)
HAProxy garantiza que ninguna consulta de escritura alcance a un nodo secundario utilizando verificaciones HTTP contra la API de Patroni:

```haproxy
listen postgres
    bind *:5432
    option httpchk GET /primary
    http-check expect status 200
    default-server inter 3s fall 3 rise 2 on-marked-down shutdown-sessions
    server nodo1 nodo1:5432 maxconn 100 check port 8008
    server nodo2 nodo2:5432 maxconn 100 check port 8008
    server nodo3 nodo3:5432 maxconn 100 check port 8008
```

---

## 3. Evidencias de Replicación

Para verificar el funcionamiento correcto de la replicación en tiempo real entre el nodo Primario y los nodos Standby, se realizaron tres comprobaciones técnicas:

### 3.1. Verificación Topológica con `patronictl`
Al consultar el estado del clúster dentro de la red interna:

```bash
docker exec -it postgres_nodo1 patronictl -c /etc/patroni/patroni.yml list
```

**Salida obtenida:**
```text
+ Cluster: cluster_bancario (7707426265629032484) --------+-----+------------+-----+
| Member | Host  | Role    | State     | TL | Receive LSN | Lag | Replay LSN | Lag |
+--------+-------+---------+-----------+----+-------------+-----+------------+-----+
| nodo1  | nodo1 | Replica | streaming |  7 |   0/403F048 |   0 |  0/403F048 |   0 |
| nodo2  | nodo2 | Replica | streaming |  7 |   0/403F048 |   0 |  0/403F048 |   0 |
| nodo3  | nodo3 | Leader  | running   |  7 |             |     |            |     |
+--------+-------+---------+-----------+----+-------------+-----+------------+-----+
```

![Verificación topológica del clúster con patronictl list](img/06/patronictl-list-cluster.png)

* **Interpretación:** Se confirma la existencia de un único `Leader` (`nodo3`) en estado `running` y dos `Replica` (`nodo1` y `nodo2`) en estado `streaming`, compartiendo el mismo *Timeline* (`TL = 7`), la misma posición de LSN (`0/403F048`) y un retraso de replicación (`Lag`) igual a **0**.

### 3.2. Consistencia de Datos entre Primario y Réplicas
Tras registrar operaciones desde la aplicación web (a través de `haproxy`), se consultó directamente una de las réplicas de solo lectura (`postgres_nodo1`) comprobando que los registros se replican de forma inmediata:

```bash
docker exec -it postgres_nodo1 psql -U soderia -d soderia -c "SELECT count(*) FROM usuarios;"
```

### 3.3. Monitoreo en Tiempo Real (Prometheus y Grafana)
* **Prometheus (`scrape_interval: 2s`):** Recolecta las métricas `patroni_primary`, `patroni_replica`, `patroni_postgres_streaming` y el cálculo de diferencia de bytes WAL (`patroni_xlog_received_location - patroni_xlog_replayed_location`).
* **Grafana (Dashboard *Observabilidad Integral* — Paneles 11 y 12):** Visualiza en vivo los nodos secundarios en estado `STREAMING` y la curva de *Lag de Replicación* estable en `0 Bytes`.

---

## 4. Prueba de Fallo y Recuperación (*Failover* y *Self-Healing*)

Para demostrar que el sistema cuenta con **failover automático** y no depende de intervención manual, se ejecutó una simulación controlada de caída abrupta del nodo Primario cuando **`nodo2`** operaba como Líder:

### Cronología de la Prueba

| Fase | Tiempo | Acción Ejecutada | Comportamiento Observado en el Sistema |
| :--- | :--- | :--- | :--- |
| **1. Estado Normal** | `t = 0s` | Operación habitual de Sodería. | `nodo2` opera como **Leader** (línea amarilla en nivel `2 = Líder` en Grafana, `UP` en HAProxy). `nodo1` y `nodo3` operan como **Replicas** (`1 = Réplica` en `streaming`). |
| **2. Inyección de Falla** | `t = 1s` (`~16:44:00`) | `docker stop postgres_nodo2` | Se detiene abruptamente el contenedor del Líder (`nodo2`). La línea amarilla de `nodo2` se corta al dejar de responder y no renovar su llave TTL en `etcd`. |
| **3. Detección y Elección** | `t ≈ 10-15s` | Vencimiento del TTL en `etcd`. | Patroni detecta la caída de `nodo2`, compara el LSN de las réplicas activas (`nodo1` y `nodo3`), y promueve automáticamente a **`nodo3`** como nuevo **Leader** (la línea azul sube de `1 = Réplica` a `2 = Líder`). |
| **4. Conmutación de Tráfico** | `t ≈ 15s` | Healthcheck de HAProxy (`:8008/primary`). | HAProxy marca `nodo2` como `DOWN` y enruta el tráfico a **`nodo3`** (`UP`). El Panel 1 de Grafana pasa a mostrar **`nodo3 (nodo3:8008) LÍDER (Primario)`** en azul y **`nodo1 (nodo1:8008) RÉPLICA (Esclavo)`** en verde. |
| **5. Autocuración (*Self-Healing*)** | `t = 45s` | `docker start postgres_nodo2` | Al reiniciar el contenedor caído, Patroni detecta que **`nodo3`** ya es el nuevo Líder, degrada a `nodo2` automáticamente a **Replica** (`streaming`, `Lag = 0`) y sincroniza los cambios vía WAL. |

![Evidencia de Failover en Grafana: caída del Líder nodo2 y promoción automática de nodo3](img/06/failover-nodo2-a-nodo3.jpg)

* **Análisis de la evidencia visual (Tablero *Ciclo de Vida y Failover*):**
  * En el **Panel 2 (*Ciclo de Vida de los 3 Nodos*)** se observa cómo la línea amarilla (**`Nodo nodo2:8008`**) se mantenía en el valor **`2` (Líder)** hasta las `16:44:00`, momento en que se produjo su caída.
  * Inmediatamente después, la línea azul (**`Nodo nodo3:8008`**), que venía operando en el nivel **`1` (Réplica)** junto con **`Nodo nodo1:8008`** (línea verde), asciende automáticamente al nivel **`2` (Líder)** tomando el lugar de `nodo2`, mientras `nodo1` permanece estable en nivel `1` como réplica.
  * En el **Panel 1 (*Estado y Rol Actual*)** se refleja el resultado final en vivo: **`nodo3` como LÍDER (Primario)** en azul y **`nodo1` como RÉPLICA (Esclavo)** en verde.

### Mecanismos de Protección de Datos durante el Fallo
* **Prevención de *Split-Brain*:** Ningún nodo puede aceptar escrituras sin poseer el bloqueo exclusivo en `etcd`. Si un antiguo líder quedara aislado por red y luego volviera, Patroni lo fuerza a modo solo lectura antes de permitir transacciones conflictivas.
* **Criterio de Promoción Segura:** Solo una réplica sincronizada dentro del umbral permitido puede ganar la elección en `etcd`, evitando promover nodos desactualizados.

---

## 5. Informe sobre Consistencia y Limitaciones

### 5.1. Análisis de Consistencia (Teorema CAP)
* **Clasificación CP (Consistencia y Tolerancia a Particiones):** Ante una partición de red o caída de nodos, el clúster prioriza la **consistencia de los datos** por sobre la disponibilidad de escritura en nodos aislados. Si un nodo pierde comunicación con `etcd`, se degrada automáticamente a solo lectura para evitar divergencias.
* **Consistencia Fuerte para la Aplicación:** Debido a que HAProxy enruta el 100 % de las consultas de lectura y escritura al único nodo Primario activo, la aplicación Sodería opera bajo **consistencia fuerte**, garantizando que toda transacción confirmada sea inmediatamente visible para las consultas posteriores.
* **Ventana de Replicación (RPO):** Dado que la replicación por streaming entre el Líder y las réplicas opera de manera asíncrona por defecto, existe una ventana de milisegundos entre el *commit* en el Primario y su aplicación en las réplicas (RPO cercano a cero bajo carga normal).

### 5.2. Limitaciones Identificadas y Oportunidades de Mejora
Durante las pruebas de integración y carga masiva de datos (inyección de 6 millones de registros), se identificaron las siguientes limitaciones propias de un entorno contenerizado en un único equipo físico:

1. **Contención de Disco (I/O) bajo Carga Masiva en Entorno Local:**
   * *Problema observado:* Al ejecutar los 3 nodos PostgreSQL y `etcd` sobre el mismo disco físico de una sola máquina anfitriona, la inserción masiva de millones de registros en una sola transacción satura la capacidad de escritura del disco compartido, generando picos temporales de *replication lag* en las réplicas.
   * *Mitigación:* Realizar las cargas masivas mediante lotes paginados (*batches*) y configurar parámetros de retención de WAL (`wal_keep_size` / *replication slots*) para que el Líder no recicle segmentos antes de que las réplicas los procesen. En un despliegue productivo real, cada nodo debe alojarse en servidores/volúmenes físicos independientes.
2. **Instancia Única de `etcd` y `HAProxy`:**
   * *Limitación:* Para optimizar recursos en el entorno de desarrollo, se desplegó un único contenedor de `etcd` y uno de `HAProxy`. Si bien eliminan el punto único de fallo en la base de datos, trasladan el punto crítico al coordinador y al balanceador.
   * *Escalabilidad futura:* En producción se recomienda desplegar un clúster de **3 o 5 nodos `etcd`** (para tolerar la caída de nodos de consenso manteniendo quórum) y redundar **HAProxy** mediante dos instancias con IP flotante (*Keepalived / VRRP*).
3. **Balanceo de Lecturas:**
   * *Limitación:* Actualmente todo el tráfico SQL (escrituras y lecturas) se dirige al Primario por el puerto `5432`.
   * *Escalabilidad futura:* Configurar un segundo *frontend* en HAProxy (por ejemplo en el puerto `5433`) que distribuya las consultas `SELECT` de reportes pesados entre las réplicas (`roundrobin`), descargando de CPU y disco al nodo Líder.