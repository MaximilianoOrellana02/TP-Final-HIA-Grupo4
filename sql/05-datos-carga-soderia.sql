\set ON_ERROR_STOP on
\set filas 6000000
\set lote 100000
-- Carga reproducible para el punto 5. Se permite solo sobre soderia vacia.
DO $$ BEGIN
    IF current_database() <> 'soderia' THEN
        RAISE EXCEPTION 'La carga del punto 5 solo se permite en soderia';
    END IF;
END $$;

SELECT clock_timestamp() AS inicio_carga \gset

BEGIN;
SET LOCAL TIME ZONE 'America/Argentina/Jujuy';

LOCK TABLE public.barrios, public.usuarios, public.productos, public.clientes,
    public.historiales, public.historial_detalles IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.barrios)
        OR EXISTS (SELECT 1 FROM public.usuarios)
        OR EXISTS (SELECT 1 FROM public.productos)
        OR EXISTS (SELECT 1 FROM public.clientes)
        OR EXISTS (SELECT 1 FROM public.historiales)
        OR EXISTS (SELECT 1 FROM public.historial_detalles)
    THEN
        RAISE EXCEPTION 'La carga requiere una base de prueba con las tablas de destino vacías';
    END IF;
END;
$$;

-- Los UUID son deterministas para vincular las filas sin tablas intermedias.
CREATE FUNCTION pg_temp.id_sintetico(grupo integer, numero integer)
RETURNS uuid
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
    SELECT ('00000000-0000-4000-' || to_hex(32768 + grupo) || '-' ||
        lpad(to_hex(numero), 12, '0'))::uuid;
$$;

INSERT INTO public.barrios (id, nombre, "diasVisita", "createdAt", "updatedAt")
SELECT pg_temp.id_sintetico(1, n), 'Barrio sintético ' || n,
    CASE WHEN n % 2 = 0 THEN '["lunes", "jueves"]'::json
         ELSE '["martes", "viernes"]'::json END,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 100) AS serie(n);

INSERT INTO public.usuarios (id, username, "passwordHash", "nombreCompleto", email, "createdAt", "updatedAt")
SELECT pg_temp.id_sintetico(2, n), 'repartidor_sintetico_' || n, '!cuenta-sintetica!',
    'Repartidor sintético ' || n, 'repartidor' || n || '@example.invalid',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 20) AS serie(n);

INSERT INTO public.productos (id, nombre, "precioParticular", "precioConfianza", "createdAt", "updatedAt")
SELECT pg_temp.id_sintetico(3, n), 'Producto sintético ' || n, 1000 + n * 100, 900 + n * 90,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 12) AS serie(n);

PREPARE cargar_clientes(integer, integer) AS
INSERT INTO public.clientes (
    id, nombre, apellido, direccion, localidad, "tipoCliente", categoria,
    "barrioId", "ultimaVisitaFecha", "createdAt", "updatedAt"
)
SELECT pg_temp.id_sintetico(4, n), 'Cliente ' || n, 'Sintético',
    'Calle de prueba ' || n, 'Localidad sintética',
    (CASE WHEN n % 5 = 0 THEN 'confianza' ELSE 'particular' END)::public."enum_clientes_tipoCliente",
    (CASE WHEN n % 10 = 0 THEN 'restaurante' ELSE 'domicilio' END)::public.enum_clientes_categoria,
    pg_temp.id_sintetico(1, 1 + (n - 1) % 100), DATE '2026-11-12' - 1 - (n % 365),
    DATE '2026-11-12' - 366, CURRENT_TIMESTAMP
FROM generate_series($1, $2) AS serie(n);

-- Cada cliente tiene una entrega con un producto. Ambos INSERT usan el mismo
-- precio, cantidad y fecha de referencia para mantener coherentes los importes.
CREATE FUNCTION pg_temp.entregas_sinteticas(desde integer, hasta integer)
RETURNS TABLE (numero integer, producto_id uuid, cantidad integer, precio numeric, fecha timestamptz)
LANGUAGE sql STABLE
AS $$
    SELECT n, p.id, 1 + (n - 1) % 4,
        CASE WHEN n % 5 = 0 THEN p."precioConfianza" ELSE p."precioParticular" END,
        ((DATE '2026-11-12' - 1 - (n % 365)) + TIME '08:00' + make_interval(mins => n % 480))::timestamptz
    FROM generate_series(desde, hasta) AS serie(n)
    JOIN public.productos p ON p.id = pg_temp.id_sintetico(3, 1 + (n - 1) % 12);
$$;

PREPARE cargar_historiales(integer, integer) AS
INSERT INTO public.historiales (
    id, "clienteId", "usuarioId", fecha, "saldoAnterior", "importeTotal", "montoPagado",
    "saldoFinal", "metodoPago", "createdAt", "updatedAt"
)
SELECT pg_temp.id_sintetico(5, numero), pg_temp.id_sintetico(4, numero),
    pg_temp.id_sintetico(2, 1 + (numero - 1) % 20), fecha, 0, precio * cantidad, precio * cantidad, 0,
    (CASE numero % 3 WHEN 0 THEN 'efectivo' WHEN 1 THEN 'transferencia'
     ELSE 'mercadopago' END)::public."enum_historiales_metodoPago",
    fecha, fecha
FROM pg_temp.entregas_sinteticas($1, $2);

PREPARE cargar_detalles(integer, integer) AS
INSERT INTO public.historial_detalles (
    id, "historialId", "productoId", "cantidadEntregada", "precioUnitario", importe
)
SELECT pg_temp.id_sintetico(6, numero), pg_temp.id_sintetico(5, numero), producto_id,
    cantidad, precio, precio * cantidad
FROM pg_temp.entregas_sinteticas($1, $2);

\echo Cargando clientes, entregas y detalles en lotes de :lote filas
WITH etapas (orden, sentencia) AS (
    VALUES (1, 'cargar_clientes'), (2, 'cargar_historiales'), (3, 'cargar_detalles')
)
SELECT format('EXECUTE %I(%s, %s)', sentencia, primero, LEAST(primero + :lote - 1, :filas))
FROM etapas CROSS JOIN generate_series(1, :filas, :lote) AS lotes(primero)
ORDER BY orden, primero
\gexec

COMMIT;

SELECT round(extract(epoch FROM clock_timestamp() - :'inicio_carga'::timestamptz), 2) AS segundos_carga;
ANALYZE public.clientes, public.historiales, public.historial_detalles;

SELECT 'clientes' AS tabla, count(*) AS registros FROM public.clientes
UNION ALL
SELECT 'historiales', count(*) FROM public.historiales
UNION ALL
SELECT 'historial_detalles', count(*) FROM public.historial_detalles;

SELECT pg_database_size(current_database()) AS bytes_base,
    pg_size_pretty(pg_database_size(current_database())) AS tamano_base;
