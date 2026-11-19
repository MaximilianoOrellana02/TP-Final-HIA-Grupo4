# Punto 5: optimización y análisis de la base de datos

## Introducción y forma de medir

Analizamos consultas de las pantallas de Clientes e Historial y de los resúmenes. Buscamos reducir recorridos innecesarios, uniones usadas solo para contar y cálculos globales cuando la pantalla muestra una página de resultados.

Medimos con `EXPLAIN (ANALYZE, BUFFERS)` en PostgreSQL sobre una base de prueba independiente con **6.000.000 de registros sintéticos en total**: 300.000 clientes, 2.000.000 historiales, 3.300.000 detalles, 250.000 saldos de envases, 139.860 movimientos de stock, 10.000 repartos y 140 registros entre barrios, usuarios y productos. De los clientes, 297.000 están activos. Al terminar la carga ejecutamos `ANALYZE`; también usamos `VACUUM ANALYZE` antes de comprobar las lecturas solo por índice. Los tiempos son de ejecución **dentro de PostgreSQL**, no de la página web completa. Los planes y tiempos pueden variar con la caché y la carga del equipo.

La carga fue validada: las diez claves foráneas estaban vigentes, no hubo diferencias entre importes y detalles ni entre el saldo de clientes y su último historial. Usamos el mismo conjunto de datos para comparar cada caso. Las pruebas anteriores sobre una carga de 18 millones de filas no se mezclan con estos tiempos.

La consigna escrita de la carga pide **seis millones por tabla**; para estas pruebas usamos **seis millones en total**, según una aclaración docente registrada por el grupo. Esa aclaración no figura como constancia adjunta en las evidencias disponibles, por lo que este punto de la consigna queda pendiente de confirmar antes de entregar.

En los SQL siguientes, el período medido va del **1/11/2026 00:00 al 12/11/2026 00:00**, hora de Argentina. Para que se lean mejor usamos `:desde` y `:hasta` en lugar de repetir las fechas; `:inicioMes` es el 1/11 y `:hace30Dias` el 19/10. `:ids` representa los clientes visibles de una página. Mostramos las columnas y uniones que explican cada plan; las consultas reales pueden incluir más columnas de salida.

## Análisis de las ocho consultas

### 1. Primera página de clientes

**Qué hace.** Trae 25 clientes activos ordenados para mostrar sus datos, barrio y saldos de envases. La elegimos porque se ejecuta al abrir Clientes. La página ya se limitaba a 25 antes de unir las otras tablas; el problema era encontrar esos 25 en orden.

**SQL original y SQL después del cambio:** la consulta de la página no cambió. Este es el SQL relevante en ambas mediciones:

```sql
SELECT c.*, se."productoId", se.cantidad, b.nombre AS barrio
FROM (
  SELECT * FROM clientes
  WHERE "deletedAt" IS NULL
  ORDER BY apellido, nombre, id
  LIMIT 25 OFFSET 0
) c
LEFT JOIN saldos_envase se ON se."clienteId" = c.id
LEFT JOIN barrios b ON b.id = c."barrioId"
ORDER BY c.apellido, c.nombre, c.id;
```

Agregamos un índice parcial sobre `(apellido, nombre, id)` para clientes activos. Antes PostgreSQL recorría los 300.000 clientes y ordenaba los activos; después obtuvo los primeros 25 en orden desde el índice.

```text
Antes:   Parallel Seq Scan clientes (99.000 filas x 3 procesos)
         -> Sort -> Gather Merge -> Limit 25
         6.613 bloques compartidos; 91,099 ms
Después: Index Scan clientes_activos_apellido_nombre_id -> Limit 25
         133 bloques compartidos; 0,631 ms
```

La comparación devolvió los **mismos 25 IDs en el mismo orden**. La mejora corresponde al acceso ordenado, sin cambiar el resultado.

### 2. Conteo total de clientes activos

**Qué hace.** Da el total para paginar Clientes. El conteo original venía junto con la consulta de la página e incluía saldos y barrios aunque el filtro solo dependía de clientes.

```sql
-- Original
SELECT count(DISTINCT c.id)
FROM clientes c
LEFT JOIN saldos_envase se ON se."clienteId" = c.id
LEFT JOIN barrios b ON b.id = c."barrioId"
WHERE c."deletedAt" IS NULL;

-- Optimizada
SELECT count(*)
FROM clientes c
WHERE c."deletedAt" IS NULL;
```

Separamos en el código la búsqueda de la página y el conteo. Ya no hace falta unir 250.000 saldos ni usar `DISTINCT` para corregir las filas duplicadas por esa unión.

```text
Antes:   Index Scan clientes_pkey (297.000 activos)
         + Index Only Scan saldos_envase_cliente_producto_unique
         -> Merge Left Join -> Aggregate; 9.037 bloques; 281,822 ms
Después: Parallel Seq Scan clientes -> Partial/Finalize Aggregate
         6.375 bloques; 71,093 ms
```

Ambos dieron **297.000**. El nuevo conteo sigue recorriendo los clientes activos: para un total exacto no alcanza con mirar los primeros 25 de la página.

### 3. Conteo del historial general

**Qué hace.** Calcula cuántas entregas hay en el período para paginar el Historial. El método anterior generaba un conteo con uniones a clientes y usuarios y pedía `id` de cada historial.

```sql
-- Original
SELECT count(h.id)
FROM historiales h
LEFT JOIN clientes c ON c.id = h."clienteId"
LEFT JOIN usuarios u ON u.id = h."usuarioId"
WHERE h.fecha >= :desde AND h.fecha < :hasta;

-- Optimizada
SELECT count(*)
FROM historiales h
WHERE h.fecha >= :desde AND h.fecha < :hasta;
```

Dejamos la página de 20 entregas con sus datos relacionados y contamos por separado. PostgreSQL ya podía eliminar las uniones del conteo original, pero tenía que buscar `id` en las filas de la tabla. Con `COUNT(*)` pudo contar leyendo solo el índice existente de fecha.

```text
Antes:   Index Scan historiales_fecha; 36.674 filas;
         36.718 bloques; 37,570 ms
Después: Index Only Scan historiales_fecha; 36.674 entradas;
         Heap Fetches: 0; 220 bloques; 5,337 ms
```

El total fue **36.674** en ambos casos. No agregamos un índice nuevo para este conteo.

### 4. Conteo del historial de un cliente

**Qué hace.** Calcula el total de entregas de un cliente en su detalle. El conteo original incluía detalles y productos; al haber varios detalles por entrega necesitaba `DISTINCT`.

```sql
-- Original
SELECT count(DISTINCT h.id)
FROM historiales h
LEFT JOIN historial_detalles d ON d."historialId" = h.id
LEFT JOIN productos p ON p.id = d."productoId"
WHERE h."clienteId" = :clienteId;

-- Optimizada
SELECT count(*)
FROM historiales h
WHERE h."clienteId" = :clienteId;
```

La página conserva sus detalles y productos; solo se simplificó el conteo. Los filtros adicionales de fecha, cuando se usan en la pantalla, se aplican igualmente al conteo directo.

```text
Antes:   Index Scan historiales_cliente_fecha (7 historiales)
         -> Nested Loop con detalles (12 filas) -> Sort -> Aggregate
         43 bloques; 0,236 ms
Después: Index Only Scan historiales_cliente_fecha (7 entradas)
         Heap Fetches: 0; 4 bloques; 0,087 ms
```

El resultado fue **7** en ambos. La diferencia es de **0,149 ms** para este cliente: el SQL y el plan quedaron más simples, pero el tiempo ahorrado es pequeño.

### 5. Totales de entregas y dinero

**Qué hace.** Calcula cantidad de entregas, importe total y monto pagado en un período para el resumen. Originalmente pedía `id` y los importes a la tabla por cada fila del rango.

```sql
-- Original
SELECT count(h.id), sum(h."importeTotal"), sum(h."montoPagado")
FROM historiales h
WHERE h.fecha >= :desde AND h.fecha < :hasta;

-- Optimizada
SELECT count(*), sum(h."importeTotal"), sum(h."montoPagado")
FROM historiales h
WHERE h.fecha >= :desde AND h.fecha < :hasta;
```

Como `id` nunca es nulo, `COUNT(*)` conserva el resultado. Sumamos un índice por fecha que incluye importe, pago y método; las sumas se pueden leer desde él.

```text
Antes:   Index Scan historiales_fecha (36.674 filas);
         36.718 bloques; 49,479 ms
Después: Index Only Scan historiales_fecha_resumen_p5
         (36.674 entradas); Heap Fetches: 0;
         360 bloques; 13,563 ms
```

La mejora medida viene de evitar las visitas a las filas completas. El índice también sirve para la consulta siguiente.

### 6. Cobros por método de pago

**Qué hace.** Suma lo cobrado por efectivo, transferencia y Mercado Pago durante el período. Antes el filtro de fecha usaba un índice, pero había que volver a la tabla para obtener método e importe.

**SQL original y SQL después del cambio:** es el mismo; lo que cambió fue el índice disponible.

```sql
SELECT h."metodoPago", sum(h."montoPagado")
FROM historiales h
WHERE h.fecha >= :desde AND h.fecha < :hasta
GROUP BY h."metodoPago";
```

```text
Antes:   Index Scan historiales_fecha y lectura de filas completas;
         36.718 bloques; 56,801 ms
Después: Index Only Scan historiales_fecha_resumen_p5
         (36.674 entradas); Heap Fetches: 0;
         360 bloques; 14,537 ms
```

Reutilizamos el índice del caso 5; no creamos otro para agrupar por método. Son mediciones de ejecuciones registradas del mismo período y datos. Otra ejecución inicial dio 86,454 ms, lo que muestra la variación entre corridas.

### 7. Actividad de clientes

**Qué hace.** Calcula última entrega, cantidad de entregas recientes y si hubo actividad este mes para las tarjetas de Clientes. Antes producía actividad para todos los clientes activos aunque se mostraran 25 tarjetas.

```sql
-- Original: actividad de todos los clientes activos
SELECT h."clienteId", max(h.fecha) AS "ultimaEntrega",
       sum(CASE WHEN h.fecha >= :hace30Dias THEN 1 ELSE 0 END)
         AS "entregasUltimos30",
       max(CASE WHEN h.fecha >= :inicioMes THEN 1 ELSE 0 END)
         AS "activoMes"
FROM historiales h
JOIN clientes c ON c.id = h."clienteId"
               AND c."deletedAt" IS NULL
WHERE EXISTS (
  SELECT 1 FROM historial_detalles d
  WHERE d."historialId" = h.id AND d."cantidadEntregada" > 0
)
GROUP BY h."clienteId";

-- Optimizada: misma actividad, acotada a los clientes visibles
SELECT h."clienteId", max(h.fecha) AS "ultimaEntrega",
       sum(CASE WHEN h.fecha >= :hace30Dias THEN 1 ELSE 0 END)
         AS "entregasUltimos30",
       max(CASE WHEN h.fecha >= :inicioMes THEN 1 ELSE 0 END)
         AS "activoMes"
FROM historiales h
WHERE h."clienteId" IN (:ids)
  AND EXISTS (
    SELECT 1 FROM historial_detalles d
    WHERE d."historialId" = h.id AND d."cantidadEntregada" > 0
  )
GROUP BY h."clienteId";
```

La pantalla ahora solicita la actividad de los IDs visibles. El indicador global «Activos mes» se calcula aparte, sin pedir todas las tarjetas:

```sql
SELECT count(DISTINCT h."clienteId")
FROM historiales h
JOIN clientes c ON c.id = h."clienteId" AND c."deletedAt" IS NULL
WHERE h.fecha >= :inicioMes
  AND EXISTS (
    SELECT 1 FROM historial_detalles d
    WHERE d."historialId" = h.id AND d."cantidadEntregada" > 0
  );
```

```text
Antes:   Parallel Seq Scan de historiales y detalles
         -> Parallel Hash Semi Join -> Sort en disco
         -> Finalize GroupAggregate (297.000 clientes);
         temporales: 36.886 bloques leídos; 5.312,430 ms
Después: búsquedas por historiales_cliente_fecha para 25 clientes
         + comprobación con historial_detalles_historial;
         175 historiales examinados; 5,372 ms
KPI:     conteo global de clientes distintos activos en el mes;
         418,080 ms; resultado 59.345
```

**5.312,430 y 5,372 ms no son tiempos del mismo trabajo**: la segunda consulta procesa solo 25 clientes. Es una mejora de alcance para la pantalla. Validamos por separado que el KPI mensual siguió dando **59.345**.

### 8. Clientes con deuda vieja

**Qué hace.** Obtiene, para clientes activos con saldo positivo, la fecha del último pago y de la primera entrega. El SQL inicial agrupaba todos los historiales de todos los deudores.

```sql
-- Original
SELECT c.id, c.nombre, c.apellido, c."saldoActual",
       max(CASE WHEN h."montoPagado" > 0 THEN h.fecha END)
         AS "ultimoPago",
       min(h.fecha) AS "primeraEntrega"
FROM clientes c
LEFT JOIN historiales h ON h."clienteId" = c.id
WHERE c."saldoActual" > 0 AND c."deletedAt" IS NULL
GROUP BY c.id, c.nombre, c.apellido, c."saldoActual";

-- Optimizada: comparación global con los mismos deudores
SELECT c.id, c.nombre, c.apellido, c."saldoActual",
       pago.fecha AS "ultimoPago",
       primera.fecha AS "primeraEntrega"
FROM clientes c
LEFT JOIN LATERAL (
  SELECT h.fecha FROM historiales h
  WHERE h."clienteId" = c.id AND h."montoPagado" > 0
  ORDER BY h.fecha DESC LIMIT 1
) pago ON true
LEFT JOIN LATERAL (
  SELECT h.fecha FROM historiales h
  WHERE h."clienteId" = c.id
  ORDER BY h.fecha ASC LIMIT 1
) primera ON true
WHERE c."saldoActual" > 0 AND c."deletedAt" IS NULL;
```

El índice existente `historiales_cliente_fecha` permite buscar por cliente y detenerse en la primera fecha o en el último pago encontrado. Agregamos además un índice parcial para seleccionar deudores activos. En la aplicación, la consulta optimizada recibe `c.id IN (:ids)` para trabajar solo con las tarjetas visibles.

```text
Antes:   Parallel Seq Scan de 2.000.000 historiales
         -> unión y agrupación de 27.000 deudores; 1.419,280 ms
Después: Index Only Scan clientes_deuda_activos_p5
         -> dos búsquedas LATERAL por deudor con
         historiales_cliente_fecha; 27.000 filas; 626,746 ms
Por página: 25 deudores visibles; búsquedas por índice;
            7,038 ms
```

La comparación **global**, sobre los mismos 27.000 deudores, dio **cero diferencias en las fechas**. El plan original leyó 34.212 bloques de disco y el nuevo 4.120; parte de la diferencia de tiempo también puede depender de la caché, además del cambio de plan. Los 7,038 ms corresponden a solo 25 deudores y muestran el costo de la pantalla, no otra mejora equivalente a la comparación global.

## Índices agregados y costo

Conservamos estos tres índices. Los dos índices de historiales por fecha y por cliente citados en los planes ya existían; no los contamos como nuevos.

```sql
CREATE INDEX clientes_activos_apellido_nombre_id
ON clientes (apellido, nombre, id)
WHERE "deletedAt" IS NULL;

CREATE INDEX historiales_fecha_resumen_p5
ON historiales (fecha)
INCLUDE ("importeTotal", "montoPagado", "metodoPago");

CREATE INDEX clientes_deuda_activos_p5
ON clientes (id) INCLUDE (nombre, apellido, "saldoActual")
WHERE "deletedAt" IS NULL AND "saldoActual" > 0;
```

| Índice | Motivo de la elección | Tamaño medido |
| --- | --- | ---: |
| `clientes_activos_apellido_nombre_id` | Entrega los primeros clientes activos en el orden de la página sin ordenar toda la tabla. | 19 MB |
| `historiales_fecha_resumen_p5` | Cubre el rango de fecha, importes y método en los dos resúmenes; evita leer cada historial completo. | 77 MB |
| `clientes_deuda_activos_p5` | Deja disponibles solo los deudores activos y sus datos para el informe de deuda. | 1.960 kB |

Suman alrededor de **98 MB**. El tamaño total de la base pasó de aproximadamente **1.115 a 1.213 MB**. Cada inserción y cada actualización de las columnas indexadas requiere mantenerlos. Medimos el espacio; no hicimos una prueba separada del costo de escritura.

Probamos también un índice de **129 MB** para ordenar páginas del Historial. PostgreSQL siguió usando el índice de fecha existente y los tiempos fueron similares (**~6,5 frente a ~6,9 ms**); lo retiramos. Otro índice de **185 MB** sobre detalles no fue usado por la consulta original de cantidades por producto y también lo retiramos.

## Otros aspectos analizados

**Estadísticas, cardinalidad y selectividad.** La carga terminó con `ANALYZE`, para que el planificador tuviera estadísticas actuales. En esta base, **297.000 de 300.000 clientes** están activos (99 %), de modo que ese filtro por sí solo descarta poco. Hay **30.000 deudores**, de los cuales **27.000** están activos: el índice parcial de deuda sí trabaja con un conjunto mucho menor. El período medido contiene **36.674 de 2.000.000 historiales** (aproximadamente 1,8 %); por eso el índice de fecha resulta útil. La carga tiene 1.000 apellidos distintos y tres métodos de pago. Comparamos estimaciones y filas reales en los planes: para el rango de fecha se estimaron unas **36.098** filas frente a **36.674** reales. La cardinalidad de las uniones también explicó por qué `COUNT(DISTINCT)` aparecía en los conteos originales.

**Filtros no SARGables.** Revisamos además filtros del código en otra base del proyecto, `soderia`; esos tiempos **no son comparables** con los ocho casos de la base de seis millones. `lower(nombre)` en barrios produjo `Seq Scan`, descartó 100.001 filas y tardó **415,236 ms**; la igualdad directa sobre `nombre` usó índice y tardó **0,106 ms**, pero no conserva la misma comparación sin distinguir mayúsculas. En productos, `lower(nombre)` también hizo `Seq Scan` (**699,442 ms**). Una búsqueda de clientes con `ILIKE '%Cliente 123%'` recorrió aproximadamente un millón de clientes (**2.815,597 ms**). Son problemas detectados, **sin optimización implementada ni medición posterior equivalente**. En cambio, `lower(username)` dispone de un índice sobre esa expresión y usó `Index Scan`. Los filtros de fecha de las ocho consultas comparan la columna directamente con límites; los planes muestran `Index Cond` cuando usan el índice.

**Recorridos, uniones y configuración.** Los planes anteriores muestran dónde un recorrido completo era costoso y dónde fue razonable conservarlo: el total exacto de clientes sigue haciendo `Parallel Seq Scan`, mientras que la página ordenada y los resúmenes pasaron a lecturas por índice. También revisamos el resumen de **cantidades por producto**, que necesita recorrer muchos de los 3.300.000 detalles. Mantuvimos este SQL:

```sql
SELECT p.id, p.nombre,
       sum(d."cantidadEntregada"),
       sum(d."cantidadEnvaseDevuelto")
FROM historial_detalles d
JOIN historiales h ON h.id = d."historialId"
JOIN productos p ON p.id = d."productoId"
WHERE h.fecha >= :desde AND h.fecha < :hasta
GROUP BY p.id, p.nombre
ORDER BY p.nombre;
```

Configuramos **cuatro trabajadores paralelos** para esa consulta mediante `parallel_workers=4` en la tabla y `SET LOCAL max_parallel_workers_per_gather=4` dentro de la transacción del resumen. La prueba se hizo en ambos órdenes:

| Orden de prueba | Dos trabajadores | Cuatro trabajadores |
| --- | ---: | ---: |
| Primero 2 y después 4 | 765,002 ms | 529,744 ms |
| Primero 4 y después 2 | 619,928 ms | 437,582 ms |

El plan repartió el recorrido y la agrupación entre más procesos. Usar cuatro puede consumir más CPU y depende de que haya trabajadores disponibles. Probamos agrupar antes de unir productos: **702,003 frente a 702,220 ms**, sin diferencia útil; una variante con `LATERAL` tardó **2.191 ms**. No las adoptamos. En una prueba anterior con otra carga, aumentar `work_mem` tampoco dio una ventaja estable y no dejamos un cambio general por esa prueba.

## Resultados generales

| Consulta | Antes | Después | Comprobación o alcance |
| --- | ---: | ---: | --- |
| 1. Página de 25 clientes | 91,099 ms | 0,631 ms | Mismos 25 IDs y orden. |
| 2. Total de clientes activos | 281,822 ms | 71,093 ms | 297.000 en ambos. |
| 3. Total del historial general | 37,570 ms | 5,337 ms | 36.674 en ambos. |
| 4. Total del historial de un cliente | 0,236 ms | 0,087 ms | 7 en ambos; diferencia pequeña. |
| 5. Totales de entregas y dinero | 49,479 ms | 13,563 ms | Mismo período; lectura solo por índice. |
| 6. Cobros por método | 56,801 ms | 14,537 ms | Mismo SQL; índice compartido con 5. |
| 7. Actividad | 5.312,430 ms global | 5,372 ms para 25 clientes | Distinto alcance; KPI global separado: 418,080 ms y 59.345 clientes. |
| 8. Deuda vieja | 1.419,280 ms global | 626,746 ms global | 27.000 deudores; cero diferencias en fechas. Para 25: 7,038 ms. |

Las comparaciones 1 a 6 y la comparación **global** del caso 8 miden el mismo resultado o el mismo conjunto de filas antes y después. En el caso 7 cambiamos deliberadamente el alcance del trabajo pedido por la pantalla; no calculamos un porcentaje de mejora entre 297.000 y 25 clientes.

## Conclusión

Con los planes vimos que el mayor trabajo innecesario estaba en ordenar muchos clientes para mostrar 25, unir tablas solo para contar y calcular actividad global para una página. Separamos conteos, aprovechamos índices existentes y conservamos tres índices nuevos que mostraron utilidad en las mediciones. La deuda vieja también mejoró al buscar por cliente en vez de agrupar dos millones de historiales.

No todos los cambios dieron una gran mejora: el conteo de un cliente ahorró muy poco tiempo, y descartamos dos índices grandes y variantes de SQL que no ayudaron. Aprendimos a comparar planes y resultados junto con los tiempos, y a distinguir una consulta más rápida de una consulta que simplemente procesa menos datos. Los casos no SARGables detectados quedaron como análisis: **no tenemos pruebas de una mejora implementada para ellos**.
