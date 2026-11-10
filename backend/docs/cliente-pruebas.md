# Cliente: correcciones y pruebas

## Comportamiento

- `DELETE /api/clientes/:id` realiza baja logica mediante `deletedAt`. Devuelve 409 si hay saldo distinto de cero (deuda o credito), envases pendientes o pedidos pendientes. No borra historiales, pedidos entregados ni registros de envases saldados.
- Los clientes dados de baja no aparecen en los listados activos, no se pueden editar y no admiten nuevos pedidos ni entregas. El historial conserva su identificacion. La baja y la creacion de pedidos/entregas se coordinan bloqueando el cliente dentro de transacciones.
- Los nombres se recortan y no pueden quedar vacios. Se validan tipos, longitudes, categorias, tipo de cliente y UUID; el barrio debe existir.
- En una actualizacion, omitir un campo conserva su valor. Enviar `null` limpia direccion, telefono, localidad o barrio. Los textos opcionales vacios se normalizan a `null`.
- Latitud y longitud se envian juntas como numeros finitos: latitud entre -90 y 90, longitud entre -180 y 180. Ambas pueden enviarse como `null` para limpiar la ubicacion. No se admiten pares incompletos ni cadenas numericas.
- Cambiar direccion o localidad recalcula la ubicacion si no se enviaron coordenadas explicitas. Si no hay direccion o la geocodificacion falla, ambas coordenadas quedan en `null`. El servicio externo tiene un plazo de 5 segundos y sus resultados se validan.
- `visitado` debe ser booleano. Visitas manuales y entregas usan la fecha de `America/Argentina/Buenos_Aires`.
- `deuda-vieja` mantiene el criterio de dias desde el ultimo pago, o desde la primera entrega si nunca hubo pagos. No representa la antiguedad de cada importe pendiente. Usa dias calendario de Argentina; `dias` es un entero de 0 a 36500, con 30 por defecto.
- `saldoActual`, `latitud` y `longitud` se serializan como numeros (coordenadas tambien pueden ser `null`). Direccion, telefono y localidad se tipan como `string | null`.

## Estados HTTP

400 para datos invalidos; 401 para falta de autenticacion; 404 para cliente inexistente o dado de baja; 409 para pendientes o conflictos con relaciones; 503 para fallos de conexion y 500 para errores internos.

## Migracion

`npm run db:migrate` agrega `clientes.deletedAt` sin borrar datos. Ejecutar antes de iniciar el backend actualizado. El rollback se rechaza si hay clientes dados de baja, para evitar reactivarlos accidentalmente.

## Pruebas

- `npm test`: pruebas unitarias de Usuario y Cliente, incluyendo validacion, modelo, fecha comercial y geocodificacion simulada.
- `npm run test:integration`: pruebas HTTP y MySQL de ambos modulos, incluyendo migraciones, relaciones, bajas y concurrencia.
- La suite de Cliente crea una base `soderia_cliente_test_<hex>` usando la conexion de `config/config.js` y la elimina al terminar. Requiere permisos CREATE/DROP DATABASE y no modifica la base real.
- Geocodificacion y correo se simulan. No se envian direcciones a servicios externos ni correos durante las pruebas.

El comentario final de `src/routes/cliente.routes.ts` identifica las correcciones verificadas.
