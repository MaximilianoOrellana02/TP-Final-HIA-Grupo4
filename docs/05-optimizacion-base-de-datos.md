# 5. Optimización y análisis de la base de datos

## 1. Consultas seleccionadas

Sodería se recibió como una aplicación previamente desarrollada por Cristian Maximiliano Orellana, integrante del equipo. Las consultas y los índices existentes forman parte de ese desarrollo. Su rendimiento se considera el estado inicial del proyecto; únicamente los cambios evaluados durante este trabajo pueden presentarse como mejoras propias del punto 5.

Se identificaron consultas de Sodería en los controladores de [clientes](../backend/src/controllers/cliente.controller.ts) e [historial](../backend/src/controllers/historial.controller.ts), y en el [servicio de resúmenes](../backend/src/services/resumen.service.ts). Las mediciones se realizaron en `soderia_pruebas`, una base separada con seis millones de registros en cada tabla principal. La base `soderia`, utilizada por la aplicación, no se modificó. Los datos son sintéticos y no permiten determinar la frecuencia real de uso de las consultas; tampoco se dispone de registros de `pg_stat_statements`.

Se seleccionaron ocho consultas, numeradas de Q1 a Q8 como en los planes iniciales. Representan operaciones del código y corresponden al SQL utilizado en las mediciones; no son una captura literal del SQL generado por Sequelize. El período de prueba abarca del 01/11/2026 al 11/11/2026 inclusive. La selección de ocho casos no acredita todavía ocho optimizaciones: cada mejora deberá justificarse mediante una comparación verificable.

### Consulta 1. Listado de clientes

Obtiene los clientes activos con barrio y saldos de envases, ordenados por apellido y nombre. El controlador no limita la cantidad de resultados.

```sql
SELECT c.id, c.nombre, c.apellido, c."saldoActual",
       b.id AS "barrioId", b.nombre AS barrio,
       se."productoId", se.cantidad
FROM clientes c
LEFT JOIN barrios b ON b.id = c."barrioId"
LEFT JOIN saldos_envase se ON se."clienteId" = c.id
WHERE c."deletedAt" IS NULL
ORDER BY c.apellido, c.nombre;
```

### Consulta 2. Historial general

Obtiene la primera página de entregas del período, con datos del cliente y del usuario que registró cada entrega.

```sql
SELECT h.id, h.fecha, h."createdAt",
       c.id AS "clienteId", c.nombre, c.apellido,
       u.id AS "usuarioId", u."nombreCompleto"
FROM historiales h
JOIN clientes c ON c.id = h."clienteId"
JOIN usuarios u ON u.id = h."usuarioId"
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03'
ORDER BY h.fecha DESC, h."createdAt" DESC
LIMIT 50 OFFSET 0;
```

### Consulta 3. Conteo del historial

Cuenta las entregas del período para calcular la cantidad de páginas del historial general. Se analizó por separado del listado porque contar todos los resultados requiere un trabajo diferente de obtener una página.

```sql
SELECT count(*)
FROM historiales h
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03';
```

### Consulta 4. Historial de un cliente

Obtiene las entregas de un cliente con sus detalles y productos. El identificador corresponde a un cliente sintético de `soderia_pruebas`.

```sql
SELECT h.id, h.fecha, h."createdAt", d."productoId",
       d."cantidadEntregada", p.nombre AS producto
FROM historiales h
LEFT JOIN historial_detalles d ON d."historialId" = h.id
LEFT JOIN productos p ON p.id = d."productoId"
WHERE h."clienteId" = '00000000-0000-4000-8004-000000000001'::uuid
ORDER BY h.fecha DESC, h."createdAt" DESC
LIMIT 20;
```

### Consulta 5. Totales del período

Cuenta entregas y suma importes y pagos para el resumen de la aplicación.

```sql
SELECT count(*) AS entregas,
       sum(h."importeTotal") AS importe,
       sum(h."montoPagado") AS pagado
FROM historiales h
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03';
```

### Consulta 6. Cantidades por producto

Suma unidades entregadas y envases devueltos de cada producto.

```sql
SELECT p.id, p.nombre,
       sum(d."cantidadEntregada") AS entregados,
       sum(d."cantidadEnvaseDevuelto") AS devueltos
FROM historial_detalles d
JOIN historiales h ON h.id = d."historialId"
JOIN productos p ON p.id = d."productoId"
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03'
GROUP BY p.id, p.nombre
ORDER BY p.nombre;
```

### Consulta 7. Cobros por método de pago

Agrupa el dinero cobrado según el método de pago durante el período. Corresponde al resumen de cobros del servicio de resúmenes.

```sql
SELECT h."metodoPago", sum(h."montoPagado") AS total
FROM historiales h
WHERE h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
  AND h.fecha < TIMESTAMPTZ '2026-11-12 00:00:00-03'
GROUP BY h."metodoPago";
```

### Consulta 8. Actividad de clientes

Calcula la última entrega y los indicadores de actividad de cada cliente activo. La condición `EXISTS` considera únicamente historiales con productos entregados. Las fechas se fijaron para repetir la medición; en la aplicación se calculan según el día de consulta.

```sql
SELECT h."clienteId", max(h.fecha) AS "ultimaEntrega",
       sum(CASE WHEN h.fecha >= TIMESTAMPTZ '2026-10-13 00:00:00-03'
                THEN 1 ELSE 0 END) AS "entregasUltimos30",
       max(CASE WHEN h.fecha >= TIMESTAMPTZ '2026-11-01 00:00:00-03'
                THEN 1 ELSE 0 END) AS "activoMes"
FROM historiales h
JOIN clientes c ON c.id = h."clienteId" AND c."deletedAt" IS NULL
WHERE EXISTS (
  SELECT 1 FROM historial_detalles d
  WHERE d."historialId" = h.id AND d."cantidadEntregada" > 0
)
GROUP BY h."clienteId";
```

## 2. Planes de ejecución

Se examinaron planes estimados con `EXPLAIN` y planes reales con `EXPLAIN (ANALYZE, BUFFERS)`. La primera medición se realizó antes de crear el índice de prueba para resúmenes:

| Consulta | Operación | Tiempo inicial |
| --- | --- | ---: |
| Q1 | Listado de clientes | 59.130 ms |
| Q2 | Página del historial | 332 ms |
| Q3 | Conteo del historial | 730 ms |
| Q4 | Historial de un cliente | 3,8 ms |
| Q5 | Totales del período | 3.200 ms |
| Q6 | Cantidades por producto | 3.738 ms |
| Q7 | Cobros por método | 283 ms |
| Q8 | Actividad de clientes | 36.190 ms |

Una revisión posterior de Q1, Q2, Q5 y Q6 produjo los siguientes resultados. En esa revisión ya estaba presente el índice de prueba para resúmenes; por ello sus tiempos no son directamente comparables con los iniciales.

| Consulta | Plan previsto | Resultado observado | Tiempo |
| --- | --- | --- | ---: |
| 1. Clientes | Unión con barrios y saldos; ordenamiento de aproximadamente 5 millones de filas. | Se procesaron 6 millones de clientes. El ordenamiento utilizó espacio temporal en disco. | 25.247 ms |
| 2. Historial | Búsqueda por fecha mediante `historiales_fecha` y límite de 50 filas. | Se devolvieron 50 filas y se utilizó el índice previsto. | 292 ms |
| 5. Totales | Lectura de importes y pagos desde `historiales_fecha_resumen_p5`. | Se procesaron 180.828 historiales del período, sin buscar filas completas en la tabla. | 151 ms |
| 6. Productos | Recorrido de detalles y unión con historiales y productos. | Se leyeron 6 millones de detalles para obtener 12 totales por producto. | 2.953 ms |

`cost` representa una estimación del motor, no tiempo. Los tiempos informados son `Execution Time`; pueden variar entre corridas por la memoria disponible y la carga del equipo.

## 3. Índices, cardinalidad, selectividad y estadísticas

Se consultaron los índices y las estadísticas de las tablas de prueba. Los valores registrados por PostgreSQL se resumen a continuación.

| Tabla | Filas estimadas | Índices relevantes | Valores distintos estimados |
| --- | ---: | --- | --- |
| `clientes` | 6 millones | Clave primaria por `id`; índice por `barrioId`. | Un apellido y 100 barrios. |
| `historiales` | 6 millones | Índices previos por `fecha` y por `clienteId` y `fecha`; índices de prueba para resúmenes y para ordenar el historial. | 35.124 valores de fecha y 3 métodos de pago. |
| `historial_detalles` | 6 millones | Índices por `historialId`, `productoId` e `id`. | 12 productos. |

El conteo directo dio **6.000.000 historiales**, de los cuales **180.828** pertenecen al período elegido (**3,01 %**). El filtro por fecha reduce considerablemente las filas. En cambio, un filtro por el único apellido de los datos sintéticos no reduciría el conjunto. Las cantidades de filas y valores distintos de la tabla anterior son estadísticas estimadas; los dos conteos de historiales son exactos.

## 4. Recorridos completos y uniones

Los planes iniciales y los planes con el índice de prueba permiten distinguir las lecturas costosas de las que tienen poco impacto.

| Consulta | Observación del plan | Evaluación |
| --- | --- | --- |
| 1. Clientes | Se recorren los 6 millones de clientes mediante su índice y se ordenan en disco; se unen barrios y saldos. | El volumen del listado y su ordenamiento explican el costo. Leer los 100 barrios completos tiene poco impacto. |
| 2. Historial | La fecha se busca mediante un índice; luego se unen los datos de cliente y usuario para la página. | No se detectó un recorrido completo de `historiales`. Las uniones trabajan sobre pocas filas. |
| 3. Conteo | Se cuentan los historiales del período desde el índice por fecha ya existente. | No se detectó un recorrido completo de la tabla; el índice pertenece al diseño recibido. |
| 4. Historial de un cliente | Se utiliza el índice compuesto por cliente y fecha, y luego el índice por historial para los detalles. | La carga contiene una entrega por cliente; el tiempo bajo describe ese caso limitado. |
| 5. Totales | Se leen los historiales del período desde el índice de prueba. | No se recorre la tabla completa. |
| 6. Productos | Se recorren los 6 millones de detalles y se unen con los historiales del período. | El recorrido de detalles y esa unión concentran el trabajo. Leer los 12 productos completos tiene poco impacto. |
| 7. Cobros | En el plan inicial se accede a filas de historiales; con el índice de prueba se leen los valores desde ese índice. | El trabajo se limita al período y luego se agrupa por método de pago. |
| 8. Actividad | Se revisan los historiales y detalles, se unen con clientes activos y se agrupan 6 millones de resultados. | La unión y agrupación utilizan archivos temporales; el volumen procesado es elevado. |

Las consultas 1, 6 y 8 requieren más análisis por el volumen procesado. Los buenos tiempos obtenidos con los índices preexistentes se registran como características del proyecto recibido, no como optimizaciones realizadas en este trabajo.

## 5. Evaluación de índices

Se compararon los índices existentes y los ensayos realizados en `soderia_pruebas`. Las definiciones y los planes muestran cuáles intervienen en cada consulta.

| Tipo | Índice evaluado | Resultado |
| --- | --- | --- |
| Simple | `historiales_fecha` | Se utiliza al buscar el historial por fecha. El período seleccionado representa el 3,01 % de los historiales; no se justificó otro índice simple para esa búsqueda. |
| Compuesto | `historiales_cliente_fecha` (`clienteId`, `fecha`) | Se utiliza en el historial de un cliente. Esa consulta tardó 3,8 ms en la medición inicial. En los datos de prueba cada cliente tiene una sola entrega, por lo que este resultado no permite evaluar historiales extensos. |
| De cobertura | `historiales_fecha_resumen_p5` (`fecha` más identificador, importes, pagos y método incluidos) | En la prueba de totales pasó de 3.200 a 74 ms; cobros por método pasó de 283 a 77 ms. Los planes posteriores leen el índice sin buscar filas completas. |
| Compuesto de prueba | `historiales_fecha_creacion_p5` (`fecha`, `createdAt`) | La página del historial se obtuvo ordenada desde el índice. Ocupa 39 MB y permanece únicamente en la base de pruebas. |

El índice de cobertura se creó solo en la base de pruebas. Ocupa **337 MB** y tardó **20,7 s** en construirse. Una prueba de control que impidió temporalmente la lectura exclusiva del índice registró 2.869 ms para totales y 219 ms para cobros. Esto respalda el beneficio observado, aunque los tiempos de distintas corridas también dependen de la memoria disponible. El índice supone espacio adicional y trabajo al escribir historiales; ese impacto aún no se midió.

También se probó un índice de cobertura para `historial_detalles`. Ocupó 337 MB, pero el plan mantuvo el recorrido completo de esa tabla y no mostró una mejora clara. Por ello se descartó. No se incorporaron índices adicionales sin una ventaja comprobada.

## 6. Consultas no SARGables

Se revisaron los filtros por fecha de las consultas seleccionadas y la función [`whereFecha`](../backend/src/services/resumen.service.ts) del backend. Allí la fecha se compara con los límites del período; no se aplica una función sobre la columna. No se identificó un filtro no SARGable en estas consultas.

Como prueba de contraste, se comparó `fecha::date = DATE '2026-11-11'` con un rango desde el inicio de ese día hasta antes del día siguiente. La conversión obligó a revisar entradas de los seis millones de historiales y tardó **2.124 ms**. El rango utilizó una condición de búsqueda del índice, examinó solo el día solicitado y tardó **3,1 ms**. Se trata de un ejemplo de laboratorio, no de una consulta defectuosa encontrada en Sodería.

## 7. Optimización de consultas

Se evaluaron cambios sobre las ocho consultas seleccionadas. Los cambios que mostraron una mejora en los planes corresponden al historial paginado, los totales y los cobros por método. Las consultas conservan su SQL; las diferencias medidas se obtuvieron mediante índices en `soderia_pruebas`:

```sql
CREATE INDEX historiales_fecha_creacion_p5
ON historiales (fecha DESC, "createdAt" DESC);

CREATE INDEX historiales_fecha_resumen_p5
ON historiales (fecha)
INCLUDE (id, "importeTotal", "montoPagado", "metodoPago");
```

El índice de fecha y creación permite obtener la página ordenada. En el plan de prueba, los accesos al historial bajaron de 172 a 50 filas y los bloques compartidos consultados de 867 a 255. Ocupa 39 MB y tardó 21,2 s en construirse. La consulta original no establece un orden único cuando coinciden `fecha` y `createdAt`: ante empates, la página puede contener filas distintas entre ejecuciones o planes. Resolverlo requiere estudiar un criterio de desempate en la aplicación.

El índice de cobertura sirve a totales y cobros y ocupa 337 MB, como se indicó en la actividad 5. Los dos índices permanecen únicamente en la base de pruebas; su costo sobre inserciones y actualizaciones no se midió. Las consultas de conteo e historial por cliente ya aprovechaban índices presentes en el proyecto recibido.

## 8. Comparación de resultados

| Consulta | Medición anterior | Medición posterior o ensayo | Resultado |
| --- | ---: | ---: | --- |
| 1. Clientes | 59.130 ms | Sin cambio aceptado | Pendiente: listado y ordenamiento completos. |
| 2. Historial general | 1,918 ms | 0,728 ms | Índice compuesto; comparación de las segundas ejecuciones, con datos en memoria. |
| 3. Conteo | 19,173 ms | 28,825 ms | Se probó sin trabajadores paralelos y se descartó; también cambió el índice elegido por el plan. |
| 4. Historial de cliente | 3,822 ms | Sin cambio aceptado | Ya utiliza el índice previo; la carga tiene una sola entrega por cliente. |
| 5. Totales | 3.200 ms | 74 ms | El índice de cobertura permitió leer los valores desde el índice. |
| 6. Productos | 11.476 ms | 22.290 ms | Se descartó una alternativa de unión por historial; son corridas únicas con posible diferencia de caché. |
| 7. Cobros | 283 ms | 77 ms | El índice de cobertura permitió leer los valores desde el índice. |
| 8. Actividad | 48.986 / 35.020 ms | 37.336 / 45.922 ms | Dos ensayos con `work_mem` de 4 MB y 16 MB; tiempos variables, sin mejora confirmada. |

Los tiempos de Q5 y Q7 pueden estar afectados por la caché; los cambios de lectura se verificaron en los planes. La prueba de Q3 fue temporal y no modificó la configuración permanente. Los archivos de planes de ejecución permanecen fuera de esta rama.

En la prueba de memoria de Q8, `work_mem` se aplicó únicamente durante cada consulta. El espacio temporal informado para la agrupación bajó de 378.888 a 259.728 kB y la memoria de ese nodo aumentó de 8.249 a 36.113 kB. En la repetición con el orden invertido, los tiempos no mantuvieron la misma ventaja. El resultado no justifica un cambio general ni permite contar la consulta como optimizada.

Se cuenta con mejoras observadas en tres consultas: Q2, Q5 y Q7. **La exigencia de optimizar al menos ocho consultas todavía no está cumplida**. Las consultas pendientes no deben presentarse como optimizadas por una variación de tiempo entre corridas ni por índices que ya existían.

## 9. Parámetros de PostgreSQL

Se consultó la configuración actual del motor, sin modificarla de forma permanente.

| Parámetro | Valor | Análisis |
| --- | ---: | --- |
| `shared_buffers` | 128 MB | Memoria que PostgreSQL reserva para páginas; no se dispone de pruebas suficientes para recomendar un cambio. |
| `work_mem` | 4 MB | Memoria para operaciones como ordenamientos y agrupaciones. En Q8, 16 MB redujo el uso temporal, pero aumentó la memoria utilizada y los tiempos fueron variables; faltan pruebas de concurrencia. |
| `effective_cache_size` | 4 GB | Estimación de caché usada para elegir planes; no reserva esa memoria. Debe contrastarse con la memoria disponible para PostgreSQL. |
| `maintenance_work_mem` | 64 MB | Memoria usada en tareas de mantenimiento y creación de índices; los tiempos de construcción quedaron registrados. |
| `max_connections` | 100 | Límite de conexiones; cualquier ajuste requiere conocer la concurrencia y la memoria utilizada. |
| `max_parallel_workers_per_gather` | 2 | Permite hasta dos trabajadores por operación paralela. La prueba sin paralelismo para Q3 no justificó cambiar el valor general. |
| `random_page_cost` / `seq_page_cost` | 4 / 1 | Influyen en la elección del tipo de lectura; no se modificaron sin medir el almacenamiento. |
| `jit` | Activado | Compilación de partes de algunas consultas; no se evaluó su desactivación. |

## 10. Decisiones y efectos

Se conservaron en `soderia_pruebas` los índices para el historial paginado y los resúmenes por los resultados observados. Se descartaron el índice adicional sobre detalles y las alternativas que no mostraron una ventaja clara. La aplicación recibida de Cristian Maximiliano Orellana mantiene sus consultas e índices originales; los ensayos no se aplicaron a su base de datos.

Para finalizar el punto 5 faltan mejoras verificadas hasta alcanzar ocho consultas, mediciones comparables y pruebas del efecto de los índices sobre escritura y almacenamiento. Las consultas que ya presenten un plan adecuado deben conservarse como tales, sin atribuir su rendimiento al trabajo de optimización.
