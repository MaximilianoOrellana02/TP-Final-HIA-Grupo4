const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const db = new Sequelize('unit', 'unit', 'unit', { dialect: 'mysql', logging: false });
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const Historial = require('../dist/models/Historial').default;
const HistorialDetalle = require('../dist/models/HistorialDetalle').default;
const { validarEntrega, validarFiltrosHistorial, validarRangoFechas, redondear, IMPORTE_MAXIMO, LIMITE_PAGINA, DatosHistorialInvalidos } = require('../dist/utils/historial.validation');
const { esDiaComercial, rangoDiaComercial, fechaComercial } = require('../dist/utils/fecha-comercial');
after(() => db.close());

const clienteId = '11111111-1111-4111-8111-111111111111';
const productoId = '22222222-2222-4222-8222-222222222222';
const otroProducto = '33333333-3333-4333-8333-333333333333';
const linea = (extra = {}) => ({ productoId, cantidadEntregada: 2, ...extra });

test('deliveries require a uuid client and at least a product line or a payment', () => {
    for (const body of [undefined, null, [], 'x', {}, { clienteId: 'abc', montoPagado: 10 }, { clienteId }, { clienteId, montoPagado: 0 },
        { clienteId, detalles: [] }, { clienteId, detalles: 'x' }, { clienteId, detalles: {} }, { clienteId, detalles: [null] }, { clienteId, detalles: ['x'] }]) {
        assert.throws(() => validarEntrega(body), DatosHistorialInvalidos, JSON.stringify(body));
    }
    assert.deepEqual(validarEntrega({ clienteId, montoPagado: 10 }), { clienteId, montoPagado: 10, metodoPago: 'efectivo', observacion: null, detalles: [] });
});

test('payments, methods and observations are validated and normalized', () => {
    for (const body of [{ montoPagado: -1 }, { montoPagado: '10' }, { montoPagado: 1.005 }, { montoPagado: NaN }, { montoPagado: IMPORTE_MAXIMO + 1 },
        { montoPagado: 10, metodoPago: 'bitcoin' }, { montoPagado: 10, metodoPago: 'Efectivo' }, { montoPagado: 10, metodoPago: 1 },
        { montoPagado: 10, observacion: 5 }, { montoPagado: 10, observacion: 'x'.repeat(256) }]) {
        assert.throws(() => validarEntrega({ clienteId, ...body }), DatosHistorialInvalidos, JSON.stringify(body));
    }
    const entrega = validarEntrega({ clienteId, montoPagado: 10.5, metodoPago: 'mercadopago', observacion: '  Pago parcial  ' });
    assert.equal(entrega.metodoPago, 'mercadopago'); assert.equal(entrega.observacion, 'Pago parcial');
    assert.equal(validarEntrega({ clienteId, montoPagado: 1, observacion: '   ' }).observacion, null);
    assert.equal(validarEntrega({ clienteId, montoPagado: IMPORTE_MAXIMO }).montoPagado, IMPORTE_MAXIMO);
});

test('detail lines validate ids, integer quantities, optional prices and forbid duplicates', () => {
    for (const detalle of [linea({ productoId: 'abc' }), linea({ cantidadEntregada: -2 }), linea({ cantidadEntregada: 1.5 }), linea({ cantidadEntregada: 'dos' }),
        linea({ cantidadEntregada: 0 }), linea({ cantidadEntregada: 0, cantidadEnvaseDevuelto: 0 }), linea({ cantidadEnvaseDevuelto: -3 }), linea({ cantidadEnvaseDevuelto: 2.5 }),
        linea({ precioUnitario: -100 }), linea({ precioUnitario: '100' }), linea({ precioUnitario: 10.123 }), linea({ precioUnitario: IMPORTE_MAXIMO + 1 })]) {
        assert.throws(() => validarEntrega({ clienteId, detalles: [detalle] }), DatosHistorialInvalidos, JSON.stringify(detalle));
    }
    assert.throws(() => validarEntrega({ clienteId, detalles: [linea(), linea({ cantidadEntregada: 1 })] }), /una sola vez/);
    const entrega = validarEntrega({ clienteId, detalles: [linea({ cantidadEnvaseDevuelto: 1, precioUnitario: 0 }), { productoId: otroProducto, cantidadEnvaseDevuelto: 3, precioUnitario: null }] });
    assert.deepEqual(entrega.detalles, [
        { productoId, cantidadEntregada: 2, cantidadEnvaseDevuelto: 1, precioUnitario: 0 },
        { productoId: otroProducto, cantidadEntregada: 0, cantidadEnvaseDevuelto: 3 },
    ]);
    assert.equal(entrega.montoPagado, 0);
});

test('balance adjustments require an explicit valid expected balance, new debt and reason', () => {
    const ajusteSaldo = { saldoEsperado: -25.5, saldoNuevo: 15000, motivo: '  Deuda previa  ' };
    assert.deepEqual(validarEntrega({ clienteId, montoPagado: 10, ajusteSaldo }).ajusteSaldo,
        { saldoEsperado: -25.5, saldoNuevo: 15000, motivo: 'Deuda previa' });
    for (const value of [null, [], {}, { ...ajusteSaldo, saldoEsperado: '0' }, { ...ajusteSaldo, saldoEsperado: NaN },
        { ...ajusteSaldo, saldoEsperado: IMPORTE_MAXIMO + 1 }, { ...ajusteSaldo, saldoEsperado: 0.001 },
        { ...ajusteSaldo, saldoNuevo: -1 }, { ...ajusteSaldo, saldoNuevo: '15000' }, { ...ajusteSaldo, saldoNuevo: Infinity },
        { ...ajusteSaldo, saldoNuevo: 1.005 }, { ...ajusteSaldo, saldoNuevo: IMPORTE_MAXIMO + 1 },
        { ...ajusteSaldo, saldoEsperado: 15000 }, { ...ajusteSaldo, motivo: '' }, { ...ajusteSaldo, motivo: 'x'.repeat(256) }]) {
        assert.throws(() => validarEntrega({ clienteId, montoPagado: 10, ajusteSaldo: value }), DatosHistorialInvalidos);
    }
    assert.throws(() => validarEntrega({ clienteId, ajusteSaldo }), /al menos un producto/);
});

test('amounts are rounded to cents', () => {
    assert.equal(redondear(3 * 33.33), 99.99); assert.equal(redondear(0.1 + 0.2), 0.3); assert.equal(redondear(-1.005), -1);
});

test('date filters accept ISO instants or Argentine commercial days and validate pagination', () => {
    for (const query of [{ desde: 'abc' }, { hasta: '' }, { desde: ['2026-01-01'] }, { desde: '2026-13-01' }, { desde: '2026-02-30' },
        { desde: '2026-02-01', hasta: '2026-01-01' }, { page: '0' }, { page: 'abc' }, { page: '-1' }, { limit: '0' }, { limit: String(LIMITE_PAGINA + 1) }, { limit: '1.5' }]) {
        assert.throws(() => validarFiltrosHistorial(query), DatosHistorialInvalidos, JSON.stringify(query));
    }
    assert.deepEqual(validarFiltrosHistorial(undefined), { page: 1, limit: 20 });
    assert.deepEqual(validarFiltrosHistorial({ page: '3', limit: '100' }), { page: 3, limit: 100 });
    assert.deepEqual(validarFiltrosHistorial({}, 500, 100), { page: 1, limit: 100 });
    const rango = validarRangoFechas({ desde: '2026-01-01', hasta: '2026-01-31' });
    assert.equal(rango.desde.toISOString(), '2026-01-01T03:00:00.000Z'); assert.equal(rango.hasta.toISOString(), '2026-02-01T02:59:59.999Z');
    assert.equal(validarRangoFechas({ desde: '2026-01-01T10:00:00Z' }).desde.toISOString(), '2026-01-01T10:00:00.000Z');
    assert.deepEqual(validarRangoFechas({ otro: 'x' }), {});
});

test('commercial day helpers use the fixed -03:00 offset', () => {
    assert.ok(esDiaComercial('2026-09-08')); assert.ok(!esDiaComercial('2026-9-8')); assert.ok(!esDiaComercial('2026-02-30')); assert.ok(!esDiaComercial(20260908));
    const { inicio, fin } = rangoDiaComercial('2026-09-08');
    assert.equal(fechaComercial(inicio), '2026-09-08'); assert.equal(fechaComercial(fin), '2026-09-08');
    assert.equal(fechaComercial(new Date(inicio.getTime() - 1)), '2026-09-07'); assert.equal(fechaComercial(new Date(fin.getTime() + 1)), '2026-09-09');
});

test('models expose amounts as numbers and reject negatives, bad enums and long observations', async () => {
    const base = { clienteId, usuarioId: clienteId, saldoAnterior: -10, importeTotal: 100, montoPagado: 0, saldoFinal: 90 };
    for (const data of [{ importeTotal: -1 }, { montoPagado: -1 }, { metodoPago: 'bitcoin' }, { observacion: 'x'.repeat(256) }, { clienteId: 'abc' }]) {
        await assert.rejects(Historial.build({ ...base, ...data }).validate(), { name: 'SequelizeValidationError' }, JSON.stringify(data));
    }
    const historial = Historial.build({ ...base, saldoAnterior: '-10.50', observacion: '  ok  ' });
    await historial.validate();
    assert.equal(historial.saldoAnterior, -10.5); assert.equal(typeof historial.get({ plain: true }).importeTotal, 'number');
    assert.equal(historial.observacion, 'ok'); assert.equal(historial.metodoPago, 'efectivo'); assert.ok(historial.fecha instanceof Date);
    const detalle = { historialId: clienteId, productoId, cantidadEntregada: 1, cantidadEnvaseDevuelto: 0, precioUnitario: '12.50', importe: 12.5 };
    for (const data of [{ cantidadEntregada: -1 }, { cantidadEntregada: 1.5 }, { cantidadEnvaseDevuelto: -1 }, { precioUnitario: -1 }, { importe: -1 }, { productoId: 'abc' }]) {
        await assert.rejects(HistorialDetalle.build({ ...detalle, ...data }).validate(), { name: 'SequelizeValidationError' }, JSON.stringify(data));
    }
    const construido = HistorialDetalle.build(detalle);
    await construido.validate(); assert.equal(construido.precioUnitario, 12.5);
});
