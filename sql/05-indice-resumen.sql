\set ON_ERROR_STOP on
\timing on

-- Ejecutar solo en la base de pruebas. El índice cubre las columnas leídas
-- por los resúmenes de entregas y cobros, filtrados por fecha.
DO $$ BEGIN
  IF current_database() <> 'soderia' THEN
    RAISE EXCEPTION 'Este índice es solo para soderia';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS historiales_fecha_resumen_p5
ON historiales (fecha)
INCLUDE (id, "importeTotal", "montoPagado", "metodoPago");

ANALYZE historiales;

SELECT pg_size_pretty(pg_relation_size('historiales_fecha_resumen_p5')) AS tamano_indice;
