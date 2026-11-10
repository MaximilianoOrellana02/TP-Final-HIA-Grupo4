# Usuario: autenticacion y pruebas

## Cambios de comportamiento

- Las sesiones JWT incluyen proposito, emisor, audiencia, vencimiento y version de sesion. Los tokens anteriores al cambio requieren iniciar sesion nuevamente.
- La recuperacion utiliza un token aleatorio de 32 bytes. Solo se almacena su SHA-256, con vencimiento a los 30 minutos. Solicitar otro enlace reemplaza el anterior.
- Restablecer o cambiar la contrasena consume los enlaces pendientes e invalida todas las sesiones del usuario. El frontend debe volver al login tras una respuesta exitosa.
- Registro, cambio y recuperacion exigen una contrasena de al menos 6 caracteres tras quitar espacios extremos para validar, y como maximo 72 bytes UTF-8. La contrasena se guarda sin recortarla. Login admite contrasenas cortas existentes para no bloquear cuentas antiguas.
- Username y nombre completo se recortan. Email se recorta, se convierte a minusculas y debe ser valido, obligatorio y unico.
- Registro sigue disponible para cualquier usuario autenticado. No se introdujeron roles ni privilegios basados en el nombre `admin`.

## Respuestas HTTP

| Estado | Significado |
| --- | --- |
| 400 | Datos invalidos o enlace de recuperacion vencido, invalido o utilizado |
| 401 | Credenciales o sesion invalidas; mismo mensaje para usuario inexistente y contrasena incorrecta |
| 409 | Username o email ocupado, incluyendo colisiones concurrentes |
| 429 | Limite de solicitudes; consultar Retry-After |
| 500 | Error interno |
| 503 | Fallo de conexion a la base de datos |

## Limites

Por IP y ventana de 15 minutos: login 15, recuperacion 5, restablecimiento 10, registro 20 y cambio de contrasena 10. Se cuentan tanto las solicitudes correctas como las incorrectas.

Se usa el almacenamiento en memoria de express-rate-limit, adecuado para una sola instancia. Los contadores se reinician al reiniciar el proceso. Con multiples instancias se necesita un almacen compartido; detras de un proxy se debe configurar `trust proxy` segun los proxies reales, nunca habilitar confianza indiscriminada en cabeceras del cliente.

## Migracion

Ejecutar `npm run db:migrate` antes de iniciar la version actualizada. La migracion rechaza emails vacios o duplicados y no elimina usuarios para resolverlos. Agrega version de sesion, hash y vencimiento de recuperacion, y restricciones e indices de email y token.

## Pruebas

- `npm test`: compilacion y pruebas unitarias, sin conexion a MySQL ni SMTP.
- `npm run test:integration`: compilacion y pruebas HTTP con MySQL real. Usa la conexion de `config/config.js`, crea una base aleatoria `soderia_test_<hex>` y la elimina al finalizar. Requiere permisos CREATE/DROP DATABASE. No modifica la base configurada de la aplicacion.
- Las pruebas de integracion ejecutan las migraciones, comprueban restricciones SQL y solicitudes concurrentes, y verifican el rollback y reaplicacion de la migracion de autenticacion.
- SMTP esta simulado, incluyendo errores de envio. Las pruebas no envian correos ni confirman la entrega de Gmail.

Configuracion requerida: conexion MySQL, `JWT_SECRET`, `FRONTEND_URL_RESET`, `GMAIL_USER` y `GMAIL_APP_PASSWORD` para envio real. No se incluyen credenciales en las pruebas ni en sus salidas.

Referencia de configuracion del limitador: https://express-rate-limit.mintlify.app/reference/configuration
