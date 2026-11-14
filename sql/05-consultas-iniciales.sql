\set ON_ERROR_STOP on
\pset pager off
\timing on

-- Punto 5: consultas equivalentes a operaciones del backend. Ejecutar solo
-- en soderia. EXPLAIN ANALYZE ejecuta cada SELECT, sin cambiar datos.
DO $$ BEGIN
  IF current_database() <> 'soderia' THEN
    RAISE EXCEPTION 'Estas mediciones son solo para soderia';
  END IF;
END $$;

SET statement_timeout = '180s';
SET temp_file_limit = '1GB';

\echo Q1. Listado de clientes con barrio y saldo de envases (cliente.controller.ts:43)
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.id, c.nombre, c.apellido, c."saldoActual", b.id AS "barrioId", b.nombre AS barrio,
       se."productoId", se.cantidad
FROM clientes c
LEFT JOIN barrios b ON b.id = c."barrioId"
LEFT JOIN saldos_envase se ON se."clienteId" = c.id
WHERE c."deletedAt" IS NULL
ORDER BY c.apellido, c.nombre;

\echo Q2. Página del historial general con cliente y usuario (historial.controller.ts:239)
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

\echo Q3. Conteo para paginar el historial general (historial.controller.ts:242)
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*)
FROM historiales h
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03';

\echo Q4. Historial de un cliente con detalles y productos (historial.controller.ts:203)
EXPLAIN (ANALYZE, BUFFERS)
SELECT h.id, h.fecha, h."createdAt", d."productoId", d."cantidadEntregada", p.nombre AS producto
FROM historiales h
LEFT JOIN historial_detalles d ON d."historialId" = h.id
LEFT JOIN productos p ON p.id = d."productoId"
WHERE h."clienteId" = '00000000-0000-4000-8004-000000000001'::uuid
ORDER BY h.fecha DESC, h."createdAt" DESC
LIMIT 20;

\echo Q5. Totales del resumen de entregas (resumen.service.ts:32)
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) AS entregas, sum(h."importeTotal") AS importe,
       sum(h."montoPagado") AS pagado
FROM historiales h
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03';

\echo Q6. Cantidades por producto del resumen (resumen.service.ts:43)
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id, p.nombre, sum(d."cantidadEntregada") AS entregados,
       sum(d."cantidadEnvaseDevuelto") AS devueltos
FROM historial_detalles d
JOIN historiales h ON h.id = d."historialId"
JOIN productos p ON p.id = d."productoId"
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03'
GROUP BY p.id, p.nombre
ORDER BY p.nombre;

\echo Q7. Cobros por método (resumen.service.ts:75)
EXPLAIN (ANALYZE, BUFFERS)
SELECT h."metodoPago", sum(h."montoPagado") AS total
FROM historiales h
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03'
GROUP BY h."metodoPago";

\echo Q8. Actividad de clientes (cliente.controller.ts:292)
EXPLAIN (ANALYZE, BUFFERS)
SELECT h."clienteId", max(h.fecha) AS "ultimaEntrega",
       sum(CASE WHEN h.fecha >= TIMESTAMPTZ '2026-10-13 00:00:00-03' THEN 1 ELSE 0 END) AS "entregasUltimos30",
       max(CASE WHEN h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03' THEN 1 ELSE 0 END) AS "activoMes"
FROM historiales h
JOIN clientes c ON c.id = h."clienteId" AND c."deletedAt" IS NULL
WHERE EXISTS (
  SELECT 1 FROM historial_detalles d
  WHERE d."historialId" = h.id AND d."cantidadEntregada" > 0
)
GROUP BY h."clienteId";
