-- Carga sintetica para la base soderia (PostgreSQL).
-- Preparada para compartir; este archivo NO se ejecuto al crearlo.
-- Requiere el esquema creado por las migraciones del backend.
-- Sustituye los datos de las 8 tablas de negocio; conserva usuarios y contrasenas.
-- Solo funciona cuando current_database() = 'soderia'. Hacer backup antes de ejecutarlo.
-- Al terminar debe haber 6.000.000 filas sinteticas, mas los usuarios previos.
-- Fecha de referencia fija: 2026-11-18 para repetir las mismas mediciones.
-- Ejecutar el archivo completo en una misma sesion de PostgreSQL (psql o pgAdmin).

DO $$
BEGIN
  IF current_database() <> 'soderia' THEN
    RAISE EXCEPTION 'Esta carga solo se permite en la base soderia';
  END IF;
END $$;

-- Los indices de optimizacion se conservan. Esto reemplaza las filas de negocio.
TRUNCATE TABLE
  public.repartos, public.movimientos_stock, public.saldos_envase,
  public.historial_detalles, public.historiales, public.clientes,
  public.productos, public.barrios;

DROP TABLE IF EXISTS pg_temp.inicio_carga;
CREATE TEMP TABLE inicio_carga AS SELECT clock_timestamp() AS inicio;

CREATE OR REPLACE FUNCTION pg_temp.id_sintetico(grupo integer, numero integer)
RETURNS uuid LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT ('00000000-0000-4000-' || to_hex(32768 + grupo) || '-' ||
          lpad(to_hex(numero), 12, '0'))::uuid;
$$;

INSERT INTO public.barrios (id, nombre, "diasVisita", "createdAt", "updatedAt")
SELECT pg_temp.id_sintetico(1,n), 'Barrio de prueba ' || n,
       CASE WHEN n % 2 = 0 THEN '["lunes","jueves"]'::json
            ELSE '["martes","viernes"]'::json END,
       now(), now()
FROM generate_series(1,100) AS g(n);

INSERT INTO public.usuarios
  (id, username, "passwordHash", "nombreCompleto", email, rol, "createdAt", "updatedAt")
SELECT pg_temp.id_sintetico(2,n), 'prueba_carga_' || n, '!sin-acceso!',
       'Repartidor de prueba ' || n, 'prueba_carga_' || n || '@example.invalid',
       'repartidor'::public."enum_usuarios_rol", now(), now()
FROM generate_series(1,20) AS g(n)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.productos
  (id, nombre, "esRetornable", activo, "stockActual", "stockMinimo",
   "precioParticular", "precioConfianza", "createdAt", "updatedAt")
SELECT pg_temp.id_sintetico(3,n), 'Producto de prueba ' || n, true, true,
       1000, 10, 100 + 10*n, 100 + 10*n, now(), now()
FROM generate_series(1,20) AS g(n);

DO $lote$
DECLARE desde integer;
BEGIN
  FOR desde IN 1..300000 BY 100000 LOOP
    INSERT INTO public.clientes
      (id, nombre, apellido, direccion, telefono, localidad, "tipoCliente",
       categoria, "barrioId", "saldoActual", "deletedAt", "createdAt", "updatedAt")
    SELECT pg_temp.id_sintetico(4,n), 'Cliente ' || n,
           'Apellido ' || (1 + (n-1) % 1000), 'Calle ' || n,
           '000-' || lpad(n::text, 7, '0'), 'Localidad de prueba',
           (CASE WHEN n % 5 = 0 THEN 'confianza' ELSE 'particular' END)::public."enum_clientes_tipoCliente",
           (CASE WHEN n % 10 = 0 THEN 'restaurante' ELSE 'domicilio' END)::public.enum_clientes_categoria,
           pg_temp.id_sintetico(1,1 + (n-1) % 100),
           CASE WHEN n % 10 = 0 THEN 100 ELSE 0 END,
           CASE WHEN n % 100 = 0 THEN TIMESTAMPTZ '2026-01-01 12:00:00-03' ELSE NULL END,
           now(), now()
    FROM generate_series(desde, LEAST(desde + 99999, 300000)) AS g(n);
  END LOOP;
END
$lote$;

-- Cada cliente tiene 6 o 7 entregas. La ultima deja 100 de deuda para
-- los clientes cuyo numero es multiplo de 10; coincide con saldoActual.
DO $lote$
DECLARE desde integer;
BEGIN
  FOR desde IN 1..2000000 BY 100000 LOOP
    INSERT INTO public.historiales
      (id, "clienteId", "usuarioId", fecha, "saldoAnterior", "importeTotal",
       "montoPagado", "saldoFinal", "metodoPago", "createdAt", "updatedAt")
    SELECT pg_temp.id_sintetico(5,n), pg_temp.id_sintetico(4,1+(n-1)%300000),
           pg_temp.id_sintetico(2,1+(n-1)%20),
           TIMESTAMPTZ '2026-11-18 12:00:00-03' -
             make_interval(days => (6-(n-1)/300000)*45 + (n%300000)%60,
                           mins => n%480),
           0,
           100 + 10*(1+(n-1)%20) +
             CASE WHEN n <= 1300000 THEN 100 + 10*(1+n%20) ELSE 0 END,
           100 + 10*(1+(n-1)%20) +
             CASE WHEN n <= 1300000 THEN 100 + 10*(1+n%20) ELSE 0 END -
             CASE WHEN (1+(n-1)%300000)%10 = 0 AND n+300000 > 2000000
                  THEN 100 ELSE 0 END,
           CASE WHEN (1+(n-1)%300000)%10 = 0 AND n+300000 > 2000000
                THEN 100 ELSE 0 END,
           (CASE n%3 WHEN 0 THEN 'efectivo' WHEN 1 THEN 'transferencia'
            ELSE 'mercadopago' END)::public."enum_historiales_metodoPago",
           now(), now()
    FROM generate_series(desde, LEAST(desde + 99999, 2000000)) AS g(n);
  END LOOP;
END
$lote$;

DO $lote$
DECLARE desde integer;
BEGIN
  FOR desde IN 1..2000000 BY 100000 LOOP
    INSERT INTO public.historial_detalles
      (id, "historialId", "productoId", "cantidadEntregada",
       "cantidadEnvaseDevuelto", "precioUnitario", importe)
    SELECT pg_temp.id_sintetico(6,n), pg_temp.id_sintetico(5,n),
           pg_temp.id_sintetico(3,1+(n-1)%20), 1,
           CASE WHEN n%4=0 THEN 1 ELSE 0 END,
           100 + 10*(1+(n-1)%20), 100 + 10*(1+(n-1)%20)
    FROM generate_series(desde, LEAST(desde + 99999, 2000000)) AS g(n);
  END LOOP;
END
$lote$;

DO $lote$
DECLARE desde integer;
BEGIN
  FOR desde IN 1..1300000 BY 100000 LOOP
    INSERT INTO public.historial_detalles
      (id, "historialId", "productoId", "cantidadEntregada",
       "cantidadEnvaseDevuelto", "precioUnitario", importe)
    SELECT pg_temp.id_sintetico(7,n), pg_temp.id_sintetico(5,n),
           pg_temp.id_sintetico(3,1+n%20), 1, 0,
           100 + 10*(1+n%20), 100 + 10*(1+n%20)
    FROM generate_series(desde, LEAST(desde + 99999, 1300000)) AS g(n);
  END LOOP;
END
$lote$;

DO $lote$
DECLARE desde integer;
BEGIN
  FOR desde IN 1..250000 BY 100000 LOOP
    INSERT INTO public.saldos_envase
      (id, "clienteId", "productoId", cantidad, "createdAt", "updatedAt")
    SELECT pg_temp.id_sintetico(8,n), pg_temp.id_sintetico(4,n),
           pg_temp.id_sintetico(3,1+(n-1)%20), 1+n%3, now(), now()
    FROM generate_series(desde, LEAST(desde + 99999, 250000)) AS g(n);
  END LOOP;
END
$lote$;

DO $lote$
DECLARE desde integer;
BEGIN
  FOR desde IN 1..139860 BY 100000 LOOP
    INSERT INTO public.movimientos_stock
      (id, "productoId", "usuarioId", tipo, cantidad, motivo, fecha, "createdAt", "updatedAt")
    SELECT pg_temp.id_sintetico(9,n), pg_temp.id_sintetico(3,1+(n-1)%20),
           pg_temp.id_sintetico(2,1+(n-1)%20),
           (CASE WHEN n%2=0 THEN 'entrada' ELSE 'salida' END)::public."enum_movimientos_stock_tipo",
           1+n%5, 'Movimiento sintetico',
           TIMESTAMPTZ '2026-11-18 12:00:00-03' - (n%730)*interval '1 day',
           now(), now()
    FROM generate_series(desde, LEAST(desde + 99999, 139860)) AS g(n);
  END LOOP;
END
$lote$;

INSERT INTO public.repartos
  (id, "usuarioId", fecha, "iniciadoEn", "finalizadoEn", "createdAt", "updatedAt")
SELECT pg_temp.id_sintetico(10,n), pg_temp.id_sintetico(2,1+(n-1)%20),
       DATE '2026-11-18' - ((n-1)/20),
       (DATE '2026-11-18' - ((n-1)/20) + TIME '08:00')::timestamp,
       (DATE '2026-11-18' - ((n-1)/20) + TIME '17:00')::timestamp,
       now(), now()
FROM generate_series(1,10000) AS g(n);

ANALYZE public.barrios, public.usuarios, public.productos, public.clientes,
        public.historiales, public.historial_detalles, public.saldos_envase,
        public.movimientos_stock, public.repartos;

WITH conteos AS (
  SELECT 'barrios' tabla, count(*) filas FROM public.barrios
  UNION ALL SELECT 'usuarios', count(*) FROM public.usuarios
  UNION ALL SELECT 'productos', count(*) FROM public.productos
  UNION ALL SELECT 'clientes', count(*) FROM public.clientes
  UNION ALL SELECT 'historiales', count(*) FROM public.historiales
  UNION ALL SELECT 'historial_detalles', count(*) FROM public.historial_detalles
  UNION ALL SELECT 'saldos_envase', count(*) FROM public.saldos_envase
  UNION ALL SELECT 'movimientos_stock', count(*) FROM public.movimientos_stock
  UNION ALL SELECT 'repartos', count(*) FROM public.repartos
)
SELECT tabla, filas FROM conteos
UNION ALL SELECT 'TOTAL', sum(filas) FROM conteos
ORDER BY tabla;

SELECT count(*) FILTER (WHERE "saldoActual" > 0) AS clientes_con_deuda,
       count(*) FILTER (WHERE "deletedAt" IS NOT NULL) AS clientes_archivados,
       count(DISTINCT apellido) AS apellidos_distintos
FROM public.clientes;

SELECT count(*) FILTER (WHERE "saldoFinal" > 0) AS entregas_con_deuda,
       count(DISTINCT "metodoPago") AS metodos_pago
FROM public.historiales;

SELECT pg_size_pretty(pg_database_size(current_database())) AS tamano_base,
       round(extract(epoch FROM clock_timestamp() - (SELECT inicio FROM pg_temp.inicio_carga)),2) AS segundos_carga;
