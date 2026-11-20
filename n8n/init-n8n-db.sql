-- Tablas auxiliares para flujos operativos de n8n (auditoria y contexto de runbooks).
-- Uso:
--   Get-Content .\n8n\init-n8n-db.sql -Raw | docker exec -i postgres_nodo1 psql -h haproxy -U soderia -d soderia -v ON_ERROR_STOP=1

CREATE TABLE IF NOT EXISTS public.n8n_execution_logs (
    id SERIAL PRIMARY KEY,
    workflow_name TEXT NOT NULL,
    execution_id TEXT,
    alert_name TEXT,
    severity TEXT,
    status TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.infrastructure_runbooks (
    id SERIAL PRIMARY KEY,
    service_name TEXT NOT NULL UNIQUE,
    issue_type TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.infrastructure_runbooks (service_name, issue_type, content)
VALUES
  ('patroni-cluster', 'failover', 'Verificar estado con patronictl list. Confirmar etcd saludable (etcdctl endpoint health) y que HAProxy enruta al nuevo Leader en :7000. Revisar lag de replicacion antes de reincorporar el nodo caido.'),
  ('postgresql-shm', 'resource_exhaustion', 'Ante errores No space left on device en /dev/shm durante consultas paralelas, validar shm_size >= 512mb en nodo1/nodo2/nodo3 dentro de docker-compose.yml.'),
  ('haproxy-router', 'routing_timeout', 'Comprobar healthcheck GET /primary en puerto 8008 de Patroni. Si una consulta analitica excede 50s, revisar indices en PostgreSQL antes de ampliar timeout server.'),
  ('pg-backup', 'backup_verification', 'Ejecutar perfil backup (pg_dump --format=custom en /backups dentro de ./datos/backups). Verificar tamano > 0, antiguedad menor a 24h y probar restauracion en base aislada.')
ON CONFLICT (service_name) DO NOTHING;
