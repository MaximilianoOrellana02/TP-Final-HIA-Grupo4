# Punto 5. Repetición de las mediciones

Las mediciones del informe se obtuvieron en `soderia_pruebas`. Para la presentación, Figueroa realizará una nueva medición sobre la base `soderia` de su equipo. Los tiempos y planes nuevos deberán registrarse por separado; no se deben reemplazar los resultados anteriores sin ejecutar las consultas.

Se requiere PostgreSQL con el esquema creado por las migraciones del proyecto. La carga sintética contiene seis millones de filas en cada una de las tablas `clientes`, `historiales` e `historial_detalles`. El script `sql/05-datos-carga-soderia.sql` comprueba que la conexión sea a `soderia` y que las tablas de destino estén vacías. Si ya hay datos de la aplicación, la carga se detiene: se debe conservar esa información y acordar otra preparación antes de continuar. No se incluye ningún comando de borrado.

Desde PowerShell, con los servicios existentes de Docker Compose en funcionamiento, se puede copiar y ejecutar cada archivo así:

```powershell
docker compose cp .\sql\05-datos-carga-soderia.sql db:/tmp/05-datos-carga-soderia.sql
docker compose exec -T db sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d soderia -f /tmp/05-datos-carga-soderia.sql'
```

Para medir, se repite el mismo par de comandos cambiando el nombre del archivo, en este orden:

1. `sql/05-consultas-iniciales.sql`: planes y tiempos antes de crear los índices del punto 5.
2. `sql/05-prueba-historial-paginado.sql`: dos mediciones de la página antes y después de crear el índice de ordenamiento.
3. `sql/05-indice-resumen.sql`: creación del índice de cobertura para totales y cobros.
4. `sql/05-consultas-iniciales.sql`: volver a medir las ocho consultas con los índices ya creados. El nombre del archivo es el mismo, pero esta salida corresponde a la medición posterior.

El orden anterior requiere una base sin los índices `historiales_fecha_creacion_p5` e `historiales_fecha_resumen_p5` al comenzar. Si existen, el segundo paso ya no representa una comparación anterior y posterior. El script de carga usa una fecha de referencia fija, 12/11/2026, para que los filtros de las consultas seleccionen el mismo período en distintos días.

Las salidas de `EXPLAIN (ANALYZE, BUFFERS)` deben guardarse con el nombre del equipo y la fecha de ejecución. Se comparan `Execution Time`, tipo de acceso, filas y bloques leídos. Las diferencias de tiempo pueden depender de la memoria caché y de otros procesos; una mejora se justifica con el plan y mediciones repetidas. Esta preparación reproduce los ensayos existentes, pero todavía faltan mejoras verificadas para cumplir las ocho consultas exigidas.
