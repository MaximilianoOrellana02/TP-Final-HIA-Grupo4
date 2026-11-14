\set ON_ERROR_STOP on
\pset pager off
\timing on

DO $$ BEGIN
  IF current_database() <> 'soderia' THEN
    RAISE EXCEPTION 'Prueba permitida solo en soderia';
  END IF;
END $$;
SET statement_timeout = '180s';
SET temp_file_limit = '1GB';

\echo Historial antes: primera medicion
EXPLAIN (ANALYZE, BUFFERS)
SELECT h.id, h.fecha, h."createdAt", c.id AS "clienteId", c.nombre, c.apellido,
       u.id AS "usuarioId", u."nombreCompleto"
FROM historiales h
JOIN clientes c ON c.id = h."clienteId"
JOIN usuarios u ON u.id = h."usuarioId"
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03'
ORDER BY h.fecha DESC, h."createdAt" DESC
LIMIT 50 OFFSET 0;

\echo Historial antes: segunda medicion
EXPLAIN (ANALYZE, BUFFERS)
SELECT h.id, h.fecha, h."createdAt", c.id AS "clienteId", c.nombre, c.apellido,
       u.id AS "usuarioId", u."nombreCompleto"
FROM historiales h
JOIN clientes c ON c.id = h."clienteId"
JOIN usuarios u ON u.id = h."usuarioId"
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03'
ORDER BY h.fecha DESC, h."createdAt" DESC
LIMIT 50 OFFSET 0;

\echo Crear indice para filtro y orden de la pagina
CREATE INDEX IF NOT EXISTS historiales_fecha_creacion_p5
ON historiales (fecha DESC, "createdAt" DESC);
SELECT pg_size_pretty(pg_relation_size('historiales_fecha_creacion_p5')) AS tamano_indice;

\echo Historial despues: primera medicion
EXPLAIN (ANALYZE, BUFFERS)
SELECT h.id, h.fecha, h."createdAt", c.id AS "clienteId", c.nombre, c.apellido,
       u.id AS "usuarioId", u."nombreCompleto"
FROM historiales h
JOIN clientes c ON c.id = h."clienteId"
JOIN usuarios u ON u.id = h."usuarioId"
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03'
ORDER BY h.fecha DESC, h."createdAt" DESC
LIMIT 50 OFFSET 0;

\echo Historial despues: segunda medicion
EXPLAIN (ANALYZE, BUFFERS)
SELECT h.id, h.fecha, h."createdAt", c.id AS "clienteId", c.nombre, c.apellido,
       u.id AS "usuarioId", u."nombreCompleto"
FROM historiales h
JOIN clientes c ON c.id = h."clienteId"
JOIN usuarios u ON u.id = h."usuarioId"
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03'
ORDER BY h.fecha DESC, h."createdAt" DESC
LIMIT 50 OFFSET 0;
