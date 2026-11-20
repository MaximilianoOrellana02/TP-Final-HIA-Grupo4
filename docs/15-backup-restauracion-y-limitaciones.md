# Punto 15: Backup, Restauración, Limitaciones y Documentación Final

## 1. Procedimiento de Backup (`pg_dump`)

El respaldo de la base de datos se ejecuta mediante el servicio `backup` (`postgres:17-alpine`, perfil `backup`) en `docker-compose.yml`:

```powershell
docker compose --profile backup run --rm backup
```

- Se conecta a PostgreSQL a través de `haproxy:5432` (siempre contra el nodo primario activo de Patroni).
- Genera un volcado comprimido en formato custom (`pg_dump --format=custom`) de forma atómica (archivo temporal renombrado al finalizar) dentro de `./datos/backups/`.
- El Flujo 2 de `n8n` (`n8n/workflows/flujo_02_verificacion_backups.json`) monta `./datos/backups:/backups:ro` para verificar existencia, tamaño y antigüedad de los respaldos.

## 2. Procedimiento de Restauración Controlada (`pg_restore`)

Para comprobar un respaldo sin afectar la base operativa `soderia`, se restaura en una base aislada utilizando el superusuario de PostgreSQL (`postgres`, necesario porque el rol de aplicación `soderia` no posee privilegio `CREATEDB`):

```powershell
# 1. Copiar el respaldo al contenedor líder o ejecutar vía red interna
docker cp .\datos\backups\<archivo>.dump postgres_nodo3:/tmp/restore.dump

# 2. Crear base aislada de prueba
docker exec -e PGPASSWORD=<PATRONI_SUPERUSER_PASSWORD> postgres_nodo3 `
  psql -h haproxy -U postgres -d postgres -c "CREATE DATABASE soderia_restore_test OWNER soderia;"

# 3. Restaurar el volcado
docker exec -e PGPASSWORD=<PATRONI_SUPERUSER_PASSWORD> postgres_nodo3 `
  pg_restore -h haproxy -U postgres -d soderia_restore_test --no-owner --no-acl /tmp/restore.dump

# 4. Verificar conteos y limpiar base temporal
docker exec -e PGPASSWORD=<PATRONI_SUPERUSER_PASSWORD> postgres_nodo3 `
  psql -h haproxy -U postgres -d soderia_restore_test -c "SELECT count(*) FROM clientes;"
docker exec -e PGPASSWORD=<PATRONI_SUPERUSER_PASSWORD> postgres_nodo3 `
  psql -h haproxy -U postgres -d postgres -c "DROP DATABASE soderia_restore_test;"
```

### Evidencia de prueba controlada ejecutada
- **Respaldo utilizado:** `soderia-20261120T051114Z-LHbJLj.dump` (`48.94 MB`).
- **Tiempo total de restauración (incluyendo índices y replicación síncrona/streaming en Patroni):** `309.5 s` (`309478 ms`).
- **Conteos verificados tras restaurar:** `clientes = 300.000`, `historiales = 2.000.000`, `historial_detalles = 3.300.000`.
- **Limpieza:** base temporal `soderia_restore_test` eliminada al finalizar.

## 3. Limitaciones Conocidas y Mejoras Futuras

1. **Dataset sintético de 6 millones:** la carga actual (`sql/cargar-soderia-6m-compartir.sql`) distribuye 6.000.000 de registros entre las 8 tablas de negocio con nombres sintéticos (`Cliente N`, `Apellido N`). Como mejora futura, puede reemplazarse por un generador con nombres y domicilios realistas o escalar a 6M por tabla según necesidad.
2. **Subdominios en publicación:** Tailscale MagicDNS asigna un único hostname por host (`maxy.tailafb40d.ts.net`), por lo que la app pública corre en `:443` (Funnel) y las herramientas internas en su puerto bajo `tailnet only` (Serve). Si se requiere `subdominio.dominio.com`, a futuro puede migrarse a Cloudflare Tunnel + Traefik con dominio propio.
3. **Dependencias Node.js (`npm audit`):** persisten vulnerabilidades reportadas en dependencias transitivas (`8` en backend y `14` en frontend) que requieren actualizaciones mayores de framework/ORM; quedan monitoreadas en cada corrida de GitHub Actions.
4. **Credenciales en nodos `n8n`:** `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` permite leer `$env.MANTIS_API_TOKEN` en los flujos 1 y 2. Como mejora futura, puede migrarse a credenciales `HTTP Header Auth` cifradas en la UI de `n8n`.
5. **Webhook de Mercado Pago y correo real:** deshabilitados en el entorno de demostración (`MP_HABILITADO=false`, SMTP redirigido a Mailpit).
6. **Documentación pendiente por integrantes:** los documentos específicos de diagnóstico inicial (Punto 1) y contenerización de BD/App (Puntos 4 y 7) corresponden a sus respectivos responsables.

## 4. Mapa de Documentación del Proyecto (`docs/`)

- `02-gestion-scrum.md` / `02-reuniones-scrum.md`: Punto 2 (Scrum y seguimiento).
- `03-git-colaboracion.md`: Punto 3 (Control de versiones y ramas).
- `05-informe-final-profesor.md` / `05-guia-defensa-optimizacion-6m.md`: Punto 5 (Optimización SQL y carga 6M).
- `06-Cluster.md`: Punto 6 (Clúster Patroni + etcd + HAProxy).
- `08-ci-cd.md`: Punto 8 (CI/CD GitHub Actions, GHCR, Watchtower y `compose watch`).
- `09-publicacion-internet.md`: Punto 9 (Tailscale Funnel y Serve).
- `10-monitoreo-grafana-prometheus.md`: Punto 10 (Prometheus, cAdvisor y Grafana).
- `11-automatizacion-mantis.md`: Punto 11 (Gestión de incidencias con MantisBT).
- `12-gestion-documental-nextcloud.md`: Punto 12 (Nextcloud y permisos WebDAV).
- `13-automatizacion-flujos-n8n.md`: Punto 13 (Flujos de automatización con n8n).
- `14-seguridad.md`: Punto 14 (Hardening, Trivy, pruebas controladas y respuesta).
- `15-backup-restauracion-y-limitaciones.md`: Punto 15 (Backup, restauración y limitaciones).
