# Deuda anterior al confirmar una entrega

`POST /api/historial` admite un objeto opcional `ajusteSaldo`:

```json
{
  "clienteId": "UUID del cliente",
  "montoPagado": 50,
  "detalles": [{ "productoId": "UUID del producto", "cantidadEntregada": 2 }],
  "ajusteSaldo": {
    "saldoEsperado": 0,
    "saldoNuevo": 15000,
    "motivo": "Deuda anterior al uso del sistema"
  }
}
```

`saldoNuevo` reemplaza el saldo previo; no se suma a este. Debe ser un numero
entre 0 y 99999999.99, con hasta dos decimales y distinto de `saldoEsperado`.
El saldo esperado admite valores negativos (credito); el motivo es obligatorio,
con hasta 255 caracteres. Un ajuste sin productos ni pago no es una entrega valida.

El backend bloquea el cliente y compara su saldo actual con `saldoEsperado`.
Si hubo un cambio, responde 409 sin escribir nada. Ajuste, entrega, stock, envases
y saldo final se guardan en una sola transaccion. Cancelar el formulario no guarda
el ajuste. Los clientes anteriores que no envian el campo mantienen el comportamiento.

La columna JSON nullable `historiales.ajusteSaldo` conserva ambos saldos y el motivo.
El usuario y la fecha son los del historial asociado. `saldoAnterior` contiene el
nuevo saldo usado en el calculo; `importeTotal` y `montoPagado` solo contienen los
importes de la operacion, por lo que los resumenes no cuentan la deuda previa como venta.

Antes de iniciar el backend actualizado ejecutar `npm run db:migrate`.
La migracion `20260910000000-add-ajuste-saldo-historial.js` agrega la columna sin
alterar los saldos existentes. Revertirla elimina la informacion de ajustes.

Validacion: `npm run build`, `node --test tests/historial.unit.test.cjs` y
`node --test tests/historial.integration.test.cjs`. La suite de integracion crea
y elimina una base temporal propia; no modifica los datos de la aplicacion.
