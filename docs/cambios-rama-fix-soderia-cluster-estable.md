# Cambios de la rama `fix/soderia-cluster-estable`

Esta rama se creó desde `develop` para probar ajustes relacionados con el clúster de la Sodería. El commit de implementación es `b8815c1`.

| Archivo | Diferencia respecto de `develop` | Efecto esperado |
| --- | --- | --- |
| `cluster/observabilidad/prometheus/prometheus.yml` | La consulta al exportador PostgreSQL pasa de cada 2 segundos a cada 15 segundos, con un tiempo de espera de 10 segundos. | Reduce la carga de consultas de métricas sobre PostgreSQL. |
| `cluster/scripts/docker-entrypoint.sh` | El cambio recursivo de propietario del directorio de datos se hace solo si su directorio raíz no pertenece a `postgres`. | Evita recorrer todos los archivos de la base en cada inicio cuando el propietario ya es correcto. |
| `cluster/scripts/post_bootstrap.sh` | Concede al usuario de la aplicación permiso para ejecutar `pg_ls_waldir()`. | Permite que el exportador consulte el tamaño del WAL en una base creada desde cero. |
| `docker-compose.yml` | Configura `observabilidad-integral.json` como tablero inicial de Grafana. | Abre ese tablero al entrar a Grafana. |

## Alcance y comprobación

- El permiso de `pg_ls_waldir()` se concede durante el bootstrap de una base nueva. Este cambio de script no modifica automáticamente una base que ya existe.
- La rama no incluye los archivos locales de datos, prácticas ni evidencias que están sin seguimiento en Git.
- Antes de subir la implementación, pasaron `git diff --check` y `docker compose config --quiet`.
- Estos ajustes no confirman por sí solos que los tres nodos estén activos ni que el clúster sea estable. Ese estado debe comprobarse durante la prueba de la rama.
