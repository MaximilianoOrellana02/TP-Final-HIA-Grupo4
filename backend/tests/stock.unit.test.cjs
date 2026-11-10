const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const db = new Sequelize('unit', 'unit', 'unit', { dialect: 'postgres', logging: false });
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const MovimientoStock = require('../dist/models/MovimientoStock').default;
const Producto = require('../dist/models/Producto').default;
const { validarMovimiento, validarFiltrosMovimientos, CANTIDAD_MAXIMA, DatosStockInvalidos } = require('../dist/utils/stock.validation');
after(() => db.close());

const productoId = '11111111-1111-4111-8111-111111111111';
const valido = { productoId, tipo: 'entrada', cantidad: 5 };

test('movement bodies require a uuid product, a known type and a positive integer quantity', () => {
    for (const body of [undefined, null, [], 'text', {}, { ...valido, productoId: 'abc' }, { ...valido, productoId: 5 },
        { ...valido, tipo: 'ajuste' }, { ...valido, tipo: 'Entrada' }, { ...valido, tipo: null },
        { ...valido, cantidad: 0 }, { ...valido, cantidad: -1 }, { ...valido, cantidad: 1.5 }, { ...valido, cantidad: '5' },
        { ...valido, cantidad: true }, { ...valido, cantidad: NaN }, { ...valido, cantidad: CANTIDAD_MAXIMA + 1 }]) {
        assert.throws(() => validarMovimiento(body), DatosStockInvalidos);
    }
    assert.deepEqual(validarMovimiento(valido), { productoId, tipo: 'entrada', cantidad: 5, motivo: null });
    assert.deepEqual(validarMovimiento({ ...valido, motivo: '' }), { productoId, tipo: 'entrada', cantidad: 5, motivo: null });
});

test('reasons are mandatory for exits, trimmed and bounded', () => {
    const salida = { ...valido, tipo: 'salida' };
    for (const body of [salida, { ...salida, motivo: '' }, { ...salida, motivo: '   ' }, { ...salida, motivo: null },
        { ...salida, motivo: 123 }, { ...salida, motivo: 'x'.repeat(256) }, { ...valido, motivo: {} }]) {
        assert.throws(() => validarMovimiento(body), DatosStockInvalidos);
    }
    assert.equal(validarMovimiento({ ...salida, motivo: ' Rotura ' }).motivo, 'Rotura');
    assert.equal(validarMovimiento({ ...salida, motivo: 'x'.repeat(255) }).motivo.length, 255);
});

test('listing filters reject bad ids, types and dates but accept partial ranges', () => {
    for (const query of [{ productoId: 'abc' }, { tipo: 'otro' }, { desde: 'abc' }, { hasta: '' }, { desde: ['2026-01-01'] },
        { desde: '2026-02-01', hasta: '2026-01-01' }, { tipo: { a: 1 } }]) {
        assert.throws(() => validarFiltrosMovimientos(query), DatosStockInvalidos);
    }
    assert.deepEqual(validarFiltrosMovimientos(undefined), {});
    assert.deepEqual(validarFiltrosMovimientos({ otro: 'x' }), {});
    const filtros = validarFiltrosMovimientos({ productoId, tipo: 'salida', desde: '2026-01-01', hasta: '2026-01-31T23:59:59.000Z' });
    assert.equal(filtros.productoId, productoId); assert.equal(filtros.tipo, 'salida');
    assert.equal(filtros.desde.toISOString(), '2026-01-01T00:00:00.000Z'); assert.equal(filtros.hasta.toISOString(), '2026-01-31T23:59:59.000Z');
});

test('models enforce quantities, types and bounds independently of HTTP', async () => {
    const base = { productoId, usuarioId: productoId, tipo: 'salida', cantidad: 1, motivo: 'ok' };
    for (const data of [{ cantidad: 0 }, { cantidad: -3 }, { cantidad: 1.5 }, { cantidad: CANTIDAD_MAXIMA + 1 }, { tipo: 'ajuste' }, { motivo: '' }, { motivo: 'x'.repeat(256) }, { productoId: 'abc' }]) {
        await assert.rejects(MovimientoStock.build({ ...base, ...data }).validate(), { name: 'SequelizeValidationError' });
    }
    await MovimientoStock.build(base).validate();
    await MovimientoStock.build({ ...base, motivo: null, tipo: 'entrada' }).validate();
    for (const data of [{ stockMinimo: -1 }, { stockMinimo: 1.5 }, { stockActual: 2.5 }]) {
        await assert.rejects(Producto.build({ precioParticular: 100, precioConfianza: 90, nombre: 'Soda', ...data }).validate(), { name: 'SequelizeValidationError' });
    }
    await Producto.build({ precioParticular: 100, precioConfianza: 90, nombre: 'Soda', stockMinimo: 0, stockActual: -2 }).validate();
});
