# Guía para defender la optimización con 6 millones de registros

## Qué hice

Preparé una carga de datos grande para probar la aplicación y corregí las consultas que intentaban enviar demasiados clientes al navegador. El objetivo fue que **Clientes, Productos y Hoy se puedan usar con una base grande** sin cambiar las reglas del negocio ni rediseñar el frontend.

El recorrido normal es: **Angular → API Node/Sequelize → PostgreSQL**. En la configuración principal de Docker, la API accede a PostgreSQL a través de HAProxy. La carga local de esta prueba se hizo sobre otra base `soderia`, en el contenedor `soderia-db-1`, mediante una configuración local de Docker ignorada por Git. No hay que confundir esa base local con el clúster de la configuración principal.

## Datos de la prueba

El archivo usado fue [`sql/cargar-soderia-6m-compartir.sql`](../sql/cargar-soderia-6m-compartir.sql). Vacía ocho tablas de negocio y vuelve a cargarlas con datos sintéticos; **conserva los usuarios existentes**. Por eso hay que ejecutarlo solamente en una base de prueba y revisar a qué base se está conectado. El script comprueba que el nombre de la base sea `soderia`.

| Tabla | Filas cargadas |
| --- | ---: |
| `clientes` | 300.000 |
| `historiales` | 2.000.000 |
| `historial_detalles` | 3.300.000 |
| `saldos_envase` | 250.000 |
| `movimientos_stock` | 139.860 |
| `repartos` | 10.000 |
| `barrios` | 100 |
| `productos` | 20 |
| `usuarios` | 22 en la prueba local: 20 sintéticos y 2 que ya existían |

**Total observado: 6.000.002 filas.** Son 6 millones generados más los dos usuarios previos. Los *historiales* son registros de operaciones pasadas de los clientes; no son paradas pendientes del reparto de hoy. Las fechas de esos registros van del 24/12/2025 al 18/11/2026.

Existe otro archivo, `sql/05-datos-carga-soderia.sql`, con una carga distinta: aproximadamente **6 millones en cada una de tres tablas**. No es el script utilizado para esta prueba de 6 millones en total.

## Qué fallaba y por qué

1. Docker podía usar una imagen vieja del frontend. Esa imagen todavía pedía toda la actividad y la deuda vieja sin limitar los clientes; una respuesta de actividad llegó a unos 40 MB. El navegador quedaba ocupado y parecía que no se podía entrar a Productos.
2. La pantalla **Hoy** pedía la lista completa de clientes. Con 300.000 clientes, eso generaba una consulta y una transferencia innecesariamente grandes y podía terminar en un error de tiempo de espera.
3. Un pedido de `GET /api/clientes` sin paginación también podía intentar devolver toda la tabla.

El problema principal era **la cantidad de datos solicitados y enviados en una sola petición**, no que Productos tuviera 300.000 filas: en esta prueba Productos tiene 20.

## Cómo lo corregí

- Configuré los servicios `backend` y `frontend` de Docker Compose para construir las imágenes desde el código de esta rama. Así se evita ejecutar por accidente una versión vieja al levantar el proyecto.
- La API de actividad y deuda vieja acepta una lista acotada de identificadores: entre 1 y 100 UUID válidos. La pantalla consulta solo los clientes que necesita mostrar.
- Clientes conserva su paginación de 25 filas por página; la API limita `limit` a 100. Si una base con más de 5.000 clientes recibe la petición antigua sin `page`, responde **413** rápidamente en lugar de enviar toda la tabla.
- Creé `GET /api/clientes/ruta-hoy?page=N&incluirRestaurantes=true|false`. Devuelve hasta **100 clientes por página**, además del total y `hasMore`. Selecciona clientes activos que corresponden al día de visita del barrio, restaurantes si está activada esa opción y clientes ya visitados hoy. La pantalla Hoy carga la primera página y ofrece **«Cargar más paradas»**. Mientras falten páginas, muestra que el progreso es parcial y no permite finalizar el reparto como si la ruta estuviera completa.

Se conservaron los días de visita, la opción de incluir restaurantes y la acción de comenzar el reparto. El cambio visual de Hoy es el botón de carga y la indicación de progreso parcial; no agregué pestañas ni rehice la navegación.

## Cómo explicar la pantalla Hoy de la prueba

La fecha de la prueba fue **miércoles 18/11/2026**. Los barrios sintéticos tienen visitas lunes/jueves o martes/viernes. Por eso, sin incluir restaurantes, la ruta de ese miércoles tiene **0 paradas programadas**. Si se activa «Incluir restaurantes», la API encuentra **27.000 clientes activos elegibles**, distribuidos en páginas de 100.

Los importes de **Cobrado** y las cantidades de **Entregados/Devueltos** son resúmenes de operaciones registradas con fecha de hoy. Pueden mostrar valores aunque no haya paradas programadas para este miércoles. No representan el número de clientes de la ruta.

## Qué comprobé

- Construcción de las imágenes de backend y frontend: correcta.
- API con los 300.000 clientes cargados: miércoles sin restaurantes, 0 paradas; con restaurantes, primera y segunda página de 100, total 27.000 y `hasMore=true`.
- `GET /api/clientes` sin página: 413 en la base grande. Productos: respuesta correcta con 20 productos.
- Pruebas de integración del backend: **27/27 aprobadas**, usando una base de prueba aislada de la base cargada.

Estas verificaciones prueban la compilación y las respuestas de la API. No medí una mejora porcentual de rendimiento ni hice una prueba visual automatizada del navegador; conviene decirlo así en la defensa.

## Preguntas que pueden hacer en la defensa

**¿Qué optimizaste?** La cantidad de clientes y actividad que cada petición trae de la base y envía al navegador. Se consulta por páginas o por una lista pequeña de IDs.

**¿Por qué paginar?** Porque el navegador no necesita los 300.000 clientes para mostrar una pantalla. Una página de 100 reduce el tamaño de la respuesta y el trabajo de renderizado.

**¿Por qué Hoy dice 0 paradas si existen millones de historiales?** Porque los historiales son operaciones pasadas y la ruta depende del día de visita del barrio. En la carga sintética no hay barrios programados los miércoles.

**¿Por qué hay 6.000.002 registros y no exactamente 6.000.000?** El script conservó dos usuarios que ya estaban en la base.

**¿Qué deben hacer mis compañeros para probar la rama?** Actualizar la rama, preparar su propio `.env` a partir del ejemplo y ejecutar `docker compose up -d --build`. La base local cargada y sus credenciales no viajan en Git. Para probar el volumen de seis millones deben ejecutar el script de carga en **su propia base de prueba**, después de verificar la conexión y asumir que se borrarán las tablas de negocio indicadas.
