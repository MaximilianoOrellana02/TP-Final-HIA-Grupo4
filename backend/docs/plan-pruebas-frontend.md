# Plan de pruebas del frontend contra el backend endurecido

Cubre los modulos corregidos el 2026-09-08: Usuario, Cliente, Barrio, Stock, Producto, Pedido e Historial.
El frontend es la app Angular en `../agua-y-soda-juuy-frontend` (puerto 4200) y apunta a `http://localhost:3000/api`.

## 1. Preparacion

1. Backend: `npm run db:migrate` (debe terminar con "sin pendientes") y `npm run dev`. Consola con "Servidor corriendo en http://localhost:3000".
2. Frontend: `npm start` en la carpeta del frontend. Abrir `http://localhost:4200` con DevTools > Network visible y "Preserve log" activado. Cada caso indica el status HTTP que tiene que verse en Network.
3. Sesion: usuario `admin`, contrasena `admin123`.
4. La base de desarrollo esta vacia (clientes, productos, pedidos, historial y stock en cero). Los datos semilla se cargan desde la propia app en la seccion 3, en el orden indicado, porque cada pantalla depende de la anterior.

## 2. Desajustes del frontend detectados al leer el codigo

Verificarlos primero: algunos hacen fallar casos de la seccion 3 aunque el backend responda bien.

| # | Archivo del frontend | Problema | Que hacer |
|---|---|---|---|
| F1 | `features/productos/producto-detalle/producto-detalle.ts` linea 126 | Al guardar, el precio de confianza se envia con `this.precioParticular`. El precio confianza queda pisado por el particular. | Corregir a `this.precioConfianza` (o el campo que corresponda) antes de probar el caso P4. |
| F2 | `shared/precio-historial-modal` | El listado de productos ahora trae solo el precio vigente por tipo de cliente (2 filas). El modal de historial de precios va a mostrar solo esas 2. | Hace falta un endpoint nuevo `GET /api/productos/:id/precios` en el backend. Hasta entonces, el modal muestra el precio actual. |
| F3 | `producto-detalle.ts` guardar/desactivar, `pedidos-list.ts` crear/entregar/eliminar, `cliente-detalle.ts` guardar | Muestran un texto generico ("No se pudieron guardar los cambios") e ignoran `err.error.error`. Los nuevos 400/409 traen mensajes concretos (stock insuficiente, producto desactivado, pedido ya entregado). | Usar `err.error?.error ?? 'texto generico'` como ya hacen barrios, entrega-nueva y movimientos. |
| F4 | `features/historial/entrega-nueva` | Permite cargar envases devueltos en cualquier producto. Para un producto no retornable el backend ahora responde 400. | Ocultar el control de envases cuando `esRetornable` es false. Mientras tanto, el mensaje del 400 se muestra porque este componente si usa `err.error.error`. |
| F5 | `core/models/historial.model.ts` | `HistorialInput.pedidoId` se envia pero el backend lo ignora: registrar una entrega desde un pedido no marca el pedido como entregado. | Despues de la entrega, llamar a `PedidoService.marcarEntregado(pedidoId)` desde el frontend, o agregar soporte en el backend. Caso E7 lo verifica. |
| F6 | `core/services/producto.service.ts` `desactivar` | Tipado como `Observable<Producto>`; el backend responde 204 sin cuerpo. Funciona porque el componente solo navega. | Cambiar el tipo a `Observable<void>`. |
| F7 | `core/models/historial.model.ts` `ResumenHoy` / `ResumenHistorial` | El backend agrega `fecha` y `productos` en resumen-hoy y `devueltos` por producto en resumen. | Opcional: mostrarlos en la pantalla Hoy. |
| F8 | `core/services/pedido.service.ts` | Solo lista pendientes. Ahora existen `?estado=entregado`, `?estado=todos` y `?clienteId=`. | Opcional: pestaña de entregados. |

## 3. Casos por pantalla

Formato: **Id. Accion** -> resultado esperado en pantalla -> status en Network.

### Login y sesion (`/login`)

- **L1.** Entrar con `admin` / `admin12` -> mensaje "Usuario o contrasena incorrectos" -> `POST /usuarios/login` 401.
- **L2.** Entrar con `admin` / `admin123` -> redirige a `/hoy` -> 200. Guardar el token: `localStorage` debe tener la sesion.
- **L3.** Con la app abierta, borrar el token de `localStorage` y navegar a otra pantalla -> toast "Tu sesion expiro" y vuelta a `/login` -> cualquier request 401.
- **L4.** Recuperar contrasena con un email inexistente -> la app responde igual que con uno existente (no revela si existe) -> `POST /usuarios/recuperar` 200.

### Barrios (`/barrios`)

- **B1.** Crear "Centro" con dias lunes y jueves -> aparece en la lista con los dias en orden de semana -> `POST /barrios` 201.
- **B2.** Crear "centro" (minusculas) -> mensaje "Ese barrio ya existe" -> 409.
- **B3.** Crear con nombre vacio -> mensaje de validacion -> 400.
- **B4.** Editar "Centro": agregar sabado -> se guarda -> `PUT /barrios/:id` 200.
- **B5.** Crear "Barrio temporal" y eliminarlo -> desaparece -> `DELETE /barrios/:id` 204.
- **B6.** Eliminar "Centro" despues de asignarle un cliente (caso C1) -> mensaje "El barrio tiene clientes activos y no se puede eliminar" -> 409.

### Productos (`/productos`, `/productos/nuevo`, `/productos/:id`)

- **P1.** Crear "Bidon 20L", retornable, particular 1500, confianza 1300 -> aparece en la lista con ambos precios -> `POST /productos` 201.
- **P2.** Crear "Pack agua 500ml", NO retornable, 2000 / 1800 -> 201.
- **P3.** Crear "bidon 20l" -> "Ese producto ya existe" -> 409. Crear con precio 0, negativo o con 3 decimales -> mensaje del backend -> 400.
- **P4.** En el detalle de "Bidon 20L" cambiar el precio particular a 1600 -> la lista muestra 1600 particular y 1300 confianza -> `PUT /productos/:id/precio` 201. Si confianza tambien cambio a 1600, es el desajuste F1.
- **P5.** Cambiar el precio dos veces seguidas (1600 y luego 1650) -> la lista muestra 1650 -> dos 201 (antes empataban por segundo).
- **P6.** Editar nombre a "  Bidon 20 litros  " y stock minimo 3 -> se guarda sin espacios -> `PUT /productos/:id` 200. Stock minimo -1 -> 400.
- **P7.** Desactivar "Pack agua 500ml" -> vuelve a la lista y ya no aparece -> `DELETE /productos/:id` 204.
- **P8.** Crear otro "pack agua 500ml" con precios 2100 / 1900 -> se reactiva el mismo producto (mismo id, conserva stock y movimientos) con los precios nuevos y aparece en la lista -> `POST /productos` 201. Tambien se puede reactivar con `PUT /api/productos/:id` y `{"activo": true}`.
- **P9.** Abrir el historial de precios del bidon -> muestra solo el precio vigente por tipo (desajuste F2).

### Movimientos de stock (`/productos/:id` y `/productos/movimientos`)

- **S1.** Entrada de 10 en "Bidon 20L", motivo "Compra" -> stock actual 10 -> `POST /stock/movimientos` 201.
- **S2.** Entrada de 5 en "Pack agua 500ml" -> stock 5 -> 201.
- **S3.** Salida de 20 en el bidon -> mensaje "Stock insuficiente: hay 10 y se intentan retirar 20" -> 409.
- **S4.** Salida sin motivo -> "El motivo es obligatorio para una salida" -> 400. Cantidad 0 o decimal -> 400.
- **S5.** Salida de 2 con motivo "Rotura" -> stock 8 -> 201.
- **S6.** Listado de movimientos: filtrar por producto y por tipo -> lista ordenada del mas nuevo al mas viejo -> `GET /stock/movimientos?...` 200. Filtro con fecha desde posterior a hasta -> 400.
- **S7.** Entrada de 2 para dejar el bidon en 10 (lo necesitan los casos de entrega).

### Clientes (`/clientes`, `/clientes/nuevo`, `/clientes/:id`)

- **C1.** Crear "Ana Perez", particular, domicilio, barrio Centro, direccion real de Jujuy -> aparece en la lista; si la direccion se geocodifica, el mapa muestra el punto -> `POST /clientes` 201.
- **C2.** Crear "Bar Central", confianza, restaurante, sin barrio -> 201.
- **C3.** Crear sin apellido -> 400. Con telefono de 50 caracteres -> 400.
- **C4.** Editar a Ana: cambiar direccion -> se recalcula la ubicacion -> `PUT /clientes/:id` 200. Guardar sin cambios -> 400 "No hay campos de cliente para actualizar" (verificar que la app no lo dispare o que muestre el mensaje).
- **C5.** Ajustar ubicacion en el mapa -> `PUT /clientes/:id/ubicacion` 200. Latitud 95 desde DevTools -> 400.
- **C6.** Marcar visita -> `PUT /clientes/:id/visita` 200 y "ultima visita" con la fecha de hoy (Argentina).
- **C7.** Dar de baja a Ana con saldo 0 y sin envases -> desaparece de la lista -> `DELETE /clientes/:id` 204. Su historial sigue accesible en `/clientes/:id/historial` -> 200.
- **C8.** Crear de nuevo a Ana (misma persona, nuevo id) para continuar. Despues de las entregas (seccion E), intentar la baja con saldo distinto de 0 -> "Resolver saldo, envases y pedidos pendientes antes de dar de baja" -> 409.

### Pedidos (`/pedidos`)

- **D1.** Crear pedido para Ana con detalle "  2 bidones  " -> aparece con "2 bidones" sin espacios -> `POST /pedidos` 201.
- **D2.** Crear pedido sin detalle -> aparece sin texto (detalle null) -> 201. Detalle de 300 caracteres -> 400.
- **D3.** Crear pedido para un cliente dado de baja (C7, usar el id viejo desde DevTools) -> 404.
- **D4.** Marcar entregado el pedido de D2 -> desaparece de pendientes -> `PUT /pedidos/:id/entregar` 200. Repetir el request desde DevTools -> 409 "El pedido ya fue entregado".
- **D5.** Eliminar desde DevTools el pedido ya entregado -> 409 "forma parte del historial". Eliminar un pendiente desde la app -> 204.
- **D6.** Desde DevTools: `GET /api/pedidos?estado=entregado` y `?estado=todos&clienteId=<id de Ana>` -> 200 con los pedidos correspondientes. `?estado=otro` -> 400.

### Registrar entrega (`/clientes/:clienteId/entrega`)

Precondicion: bidon con stock 10 y precio particular 1650 / confianza 1300; pack con stock 5.

- **E1.** Ana: 2 bidones, 1 envase devuelto, pago 1000 efectivo -> saldo final 2300 (2 x 1650 - 1000) -> `POST /historial` 201. Verificar en el detalle del cliente: saldo 2300, envases pendientes 1 bidon, ultima visita hoy. En productos: stock del bidon 8. En movimientos: salida de 2 "Entrega a cliente".
- **E2.** Bar Central: 1 bidon -> precio unitario 1300 (tipo confianza) -> saldo 1300 -> 201.
- **E3.** Ana: 20 bidones -> la app avisa antes de enviar ("No hay stock suficiente"). Si se fuerza desde DevTools -> 409 "Stock insuficiente de Bidon 20 litros: hay 7 y se intentan entregar 20". El saldo y el stock no cambian.
- **E4.** Ana: 1 pack agua con 1 envase devuelto -> 400 "no es retornable y no admite envases devueltos" (desajuste F4). Con 0 envases -> 201, stock del pack 4 y NO aparece en envases pendientes.
- **E5.** Ana: solo devuelve 1 envase de bidon, sin entrega ni pago -> 201, importe 0, envases pendientes 0.
- **E6.** Ana: 3 bidones con precio manual 33.33 -> importe 99.99 exacto -> 201.
- **E7.** Desde un pedido pendiente de Ana, usar "registrar entrega" (llega con `?pedidoId=`) -> la entrega se registra (201) pero el pedido sigue pendiente (desajuste F5).
- **E8.** Enviar con cantidad negativa o precio negativo desde DevTools -> 400 y nada cambia.
- **E9.** Desactivar el pack (P7) y registrar una entrega del pack -> 409 "esta desactivado". Reactivarlo (P8).

### Pago rapido (modal de pago en el detalle del cliente)

- **G1.** Ana paga 300 por transferencia -> saldo baja 300 -> `POST /historial` 201 con `detalles: []`.
- **G2.** Monto 0 o negativo -> 400 "Cargar al menos un producto o un monto pagado" / mensaje de montoPagado.
- **G3.** Pago con Mercado Pago (QR) -> fuera del alcance de estas correcciones. Solo verificar que el QR se genera o que el error se muestra.

### Historial (`/historial` y `/clientes/:id/historial`)

- **H1.** Listado general: paginado de 20, del mas reciente al mas antiguo, con cliente y usuario -> `GET /historial?page=1&limit=20` 200 con `total` y `totalPages`.
- **H2.** Filtros de la pantalla (hoy, 7 dias, mes) -> envian `desde` en ISO -> 200 y las filas corresponden.
- **H3.** Desde DevTools: `?desde=2026-09-08&hasta=2026-09-08` -> incluye todo el dia argentino. `?limit=101`, `?page=0`, `?desde=abc`, `?desde=2026-02-30` -> 400.
- **H4.** Historial de Ana: todas sus entregas con detalle de productos, importes como numeros -> `GET /historial/cliente/:id` 200 con cabecera `X-Total-Historial`.
- **H5.** Historial de la Ana dada de baja (C7) -> 200. Id inventado -> 404. Id no UUID -> 400.

### Hoy (`/hoy`)

- **Y1.** Al entrar: cobrado, entregas, entregados y devueltos coinciden con lo registrado hoy (E1..E6, G1) -> `GET /historial/resumen-hoy` 200. La respuesta trae `fecha` con la fecha argentina.
- **Y2.** Registrar una entrega despues de las 21:00 hora local si el servidor estuviera en UTC: sigue contando para hoy (dia comercial). En local no cambia nada; anotar solo si se prueba contra Render.
- **Y3.** Pedidos pendientes del dia aparecen en la pantalla (si la muestra) -> `GET /pedidos` 200.

## 4. Flujo completo de un dia (de corrido, sin DevTools)

1. Entrar como admin. 2. Reponer stock del bidon (entrada 10). 3. Crear pedido para Bar Central. 4. Desde pedidos, registrar la entrega (2 bidones, 1 envase, pago parcial). 5. Marcar el pedido como entregado. 6. Cobrar el resto desde el modal de pago. 7. Ver Hoy: cobrado y entregas actualizados. 8. Ver historial del cliente: dos movimientos, saldo final 0. 9. Intentar dar de baja al cliente: bloqueado por envases pendientes (409). 10. Registrar devolucion del envase. 11. Dar de baja: 204. 12. Su historial sigue visible.

## 5. Errores y bordes transversales

- **X1.** Apagar el backend y hacer cualquier accion -> toast "Sin conexion con el servidor" (status 0).
- **X2.** Apagar MySQL con el backend prendido y listar productos -> 503 -> la app muestra "Ocurrio un error en el servidor" (el interceptor trata 503 como 5xx).
- **X3.** Un 400 o 409 en pantallas con mensaje generico (desajuste F3) -> el motivo real esta en Network > Response.
- **X4.** Dos pestañas: en una desactivar un producto, en la otra intentar cambiarle el precio -> 409.
- **X5.** Dos pestañas: registrar a la vez dos entregas que superan el stock -> una 201 y la otra 409; el stock nunca queda negativo.
- **X6.** Ids en la URL que no son UUID (`/clientes/abc`, `/productos/abc`) -> la app muestra su pantalla de error o "no encontrado"; en Network es 400.

## 6. Verificacion en base de datos (opcional, MySQL)

```sql
SELECT nombre, stockActual FROM productos;
SELECT c.nombre, c.saldoActual, s.cantidad envases FROM clientes c LEFT JOIN saldos_envase s ON s.clienteId = c.id;
SELECT fecha, importeTotal, montoPagado, saldoFinal, metodoPago FROM historiales ORDER BY fecha DESC;
SELECT tipo, cantidad, motivo, fecha FROM movimientos_stock ORDER BY fecha DESC;
SELECT estado, detalle FROM pedidos;
```

Ningun stock ni cantidad debe ser negativo; `saldos_envase.cantidad` puede ser negativo solo si el cliente devolvio mas envases de los que se le entregaron.

## 7. Registro de resultados

Anotar por caso: OK / Falla / Bloqueado, el status visto en Network y una captura si falla. Los desajustes F1 a F8 se registran aparte como tareas del frontend. Cuando terminen las correcciones del frontend, repetir los casos marcados con F.

Referencia de estados que devuelve el backend: 400 datos invalidos, 401 sin sesion, 404 recurso inexistente o dado de baja, 409 conflicto con el estado actual (stock, duplicados, dependencias), 503 base de datos caida, 500 error interno.
