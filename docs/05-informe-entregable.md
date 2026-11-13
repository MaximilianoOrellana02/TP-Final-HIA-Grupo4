# 5. Optimización y análisis de la base de datos

## Alcance

Se analizaron consultas de Sodería, aplicación desarrollada previamente por Cristian Maximiliano Orellana, integrante del equipo. Las pruebas se realizaron en `soderia_pruebas`, una base PostgreSQL 17.11 separada de la base utilizada por la aplicación. El conjunto sintético contiene seis millones de registros en cada una de las tablas `clientes`, `historiales` e `historial_detalles`.

Se seleccionaron ocho consultas correspondientes a operaciones de la aplicación. Los datos de prueba permiten medir el comportamiento con volumen, aunque cada cliente tiene una sola entrega y todos los clientes comparten apellido. No se midió la frecuencia real de uso de las consultas.

**Estado del entregable:** se observaron mejoras en tres consultas. Todavía faltan mejoras verificadas hasta alcanzar las ocho exigidas por la consigna.

## Consultas y planes de ejecución

Las ocho consultas originales se transcriben en el informe completo. Corresponden al listado y actividad de clientes, historial general y por cliente, conteo de entregas, totales, cantidades por producto y cobros por método. Son consultas equivalentes para la prueba; no son una captura literal del SQL generado por Sequelize.

Los cambios que mostraron mejoras no reescribieron el SQL: modificaron el acceso a los datos mediante índices. Las consultas del historial paginado, totales y cobros conservan el SQL original. Los planes iniciales y posteriores se obtuvieron con `EXPLAIN (ANALYZE, BUFFERS)`; sus resultados principales se resumen en el informe completo. Los archivos de planes no forman parte de esta rama.

Los planes mostraron que el listado de clientes ordena seis millones de filas, el resumen por producto recorre seis millones de detalles y la actividad de clientes agrupa seis millones de resultados. El conteo por fecha y el historial de un cliente ya aprovechaban índices existentes en el proyecto recibido.

## Índices evaluados

En `soderia_pruebas` se conservaron dos índices adicionales:

```sql
CREATE INDEX historiales_fecha_creacion_p5
ON historiales (fecha DESC, "createdAt" DESC);

CREATE INDEX historiales_fecha_resumen_p5
ON historiales (fecha)
INCLUDE (id, "importeTotal", "montoPagado", "metodoPago");
```

| Índice | Justificación | Tamaño | Tiempo de creación |
| --- | --- | ---: | ---: |
| `historiales_fecha_creacion_p5` | Permite obtener ordenada la página del historial. En la prueba se accedió a 50 filas de historial en lugar de 172. | 39 MB | 21,2 s |
| `historiales_fecha_resumen_p5` | Incluye los valores necesarios para calcular totales y cobros sin buscar las filas completas de la tabla. | 337 MB | 20,7 s |

Los índices agregan almacenamiento y pueden aumentar el trabajo de inserciones y actualizaciones. Ese impacto en escrituras todavía no se midió.

Se probó otro índice de cobertura sobre `historial_detalles`, de 337 MB. El plan mantuvo el recorrido completo de la tabla y no mostró una mejora clara, por lo que el índice se retiró.

## Mediciones de rendimiento

| Consulta | Antes | Después o alternativa | Resultado |
| --- | ---: | ---: | --- |
| Q1. Clientes | 59.130 ms | Pendiente | No se aceptó un cambio. |
| Q2. Historial general | 1,918 ms | 0,728 ms | Índice por fecha y creación; segunda ejecución de cada caso. |
| Q3. Conteo del historial | 19,173 ms | 28,825 ms | Ensayo sin paralelismo descartado; también cambió el índice elegido. |
| Q4. Historial de un cliente | 3,822 ms | Pendiente | El plan ya utilizaba un índice previo. |
| Q5. Totales del período | 3.200 ms | 74 ms | Lectura desde el índice de cobertura. |
| Q6. Cantidades por producto | 11.476 ms | 22.290 ms | Una alternativa de unión resultó más lenta y se descartó. |
| Q7. Cobros por método | 283 ms | 77 ms | Lectura desde el índice de cobertura. |
| Q8. Actividad de clientes | 48.986 / 35.020 ms | 37.336 / 45.922 ms | Ensayos con distinta memoria de trabajo; los tiempos no mostraron una ventaja estable. |

Los valores de Q2 corresponden a corridas con datos en memoria. Q5 y Q7 corresponden a mediciones anteriores y posteriores que pueden estar afectadas por la caché; los planes muestran el cambio de acceso. Para Q6 se realizó una corrida por variante y no se comprobó una mejora. En Q8 se compararon 4 MB y 16 MB de `work_mem` en orden alternado, sin cambiar la configuración permanente.

## Parámetros y decisiones

La configuración observada incluye `shared_buffers` de 128 MB, `work_mem` de 4 MB, `effective_cache_size` de 4 GB y hasta dos trabajadores paralelos por operación. El ensayo con 16 MB de `work_mem` redujo el espacio temporal de la agrupación de Q8, pero aumentó la memoria utilizada y no presentó tiempos estables. No se recomienda un cambio general sin pruebas adicionales y de concurrencia.

El índice de fecha y creación mejora el plan de Q2, pero la consulta original no define un orden único cuando coinciden `fecha` y `createdAt`. Antes de aplicarlo a la aplicación debe evaluarse un desempate para mantener estable la paginación. Los índices existentes del proyecto original se consideran parte del estado inicial y no se atribuyen a este trabajo.

## Trabajo pendiente

Para cumplir la consigna falta alcanzar **al menos ocho consultas con mejoras justificadas**, completar comparaciones bajo condiciones repetibles y medir el efecto de los índices sobre inserciones y actualizaciones. Las alternativas que ya funcionan adecuadamente con índices existentes deben documentarse como tales. Las pruebas y los índices agregados permanecen en `soderia_pruebas`; no se aplicaron a la base de la aplicación.
