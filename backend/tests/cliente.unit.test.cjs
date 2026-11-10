const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const db = new Sequelize('unit', 'unit', 'unit', { dialect: 'mysql', logging: false });
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const Cliente = require('../dist/models/Cliente').default;
const { validarCliente, validarCoordenadas, validarDias, esUuid } = require('../dist/utils/cliente.validation');
const { fechaComercial, diasComercialesDesde } = require('../dist/utils/fecha-comercial');
const { geocodificarDireccion } = require('../dist/utils/geocode');
after(() => db.close());

test('requires object bodies, meaningful names and bounded fields', () => {
    for (const body of [undefined, null, [], 'text', {}, { nombre: ' ', apellido: 'A' }, { nombre: 123, apellido: 'A' }, { nombre: 'a'.repeat(101), apellido: 'A' }]) {
        assert.throws(() => validarCliente(body, true));
    }
    for (const body of [{ nombre: '' }, { telefono: 123 }, { telefono: 'a'.repeat(31) }, { direccion: 'a'.repeat(201) }, { localidad: 'a'.repeat(101) }, { categoria: 'invalid' }, { tipoCliente: 'invalid' }, { barrioId: 'invalid' }, {}]) {
        assert.throws(() => validarCliente(body, false));
    }
});

test('normalizes strings, preserves explicit null and ignores protected attributes', () => {
    assert.deepEqual(validarCliente({ nombre: ' Nombre ', apellido: ' Apellido ', telefono: ' ', barrioId: null, saldoActual: 999, deletedAt: '2020-01-01' }, true), {
        nombre: 'Nombre', apellido: 'Apellido', telefono: null, barrioId: null,
    });
    assert.deepEqual(validarCliente({ direccion: null, localidad: null, telefono: null, barrioId: null }, false), {
        direccion: null, localidad: null, telefono: null, barrioId: null,
    });
    assert.equal(esUuid('1da3c34c-ab2e-11f1-92c9-9c6b00387077'), true);
    assert.equal(esUuid('invalid'), false);
});

test('coordinates require a finite complete pair, with supported boundaries and clearing', () => {
    for (const body of [{}, { latitud: 0 }, { latitud: null, longitud: 0 }, { latitud: '1', longitud: 2 }, { latitud: true, longitud: 2 }, { latitud: NaN, longitud: 2 }, { latitud: 1, longitud: Infinity }, { latitud: 91, longitud: 0 }, { latitud: 0, longitud: -181 }]) assert.throws(() => validarCoordenadas(body));
    for (const body of [{ latitud: 0, longitud: 0 }, { latitud: -90, longitud: 180 }, { latitud: null, longitud: null }]) assert.deepEqual(validarCoordenadas(body), body);
});

test('day filter has a default and accepts zero but rejects ambiguous input', () => {
    assert.equal(validarDias(undefined), 30);
    assert.equal(validarDias('0'), 0);
    assert.equal(validarDias('36500'), 36500);
    for (const value of ['', '-1', '1.5', 'abc', 'Infinity', '36501', ['1', '2'], {}, '1e2']) assert.throws(() => validarDias(value));
});

test('commercial dates use Argentina at UTC midnight and month/year boundaries', () => {
    assert.equal(fechaComercial(new Date('2026-09-09T01:30:00Z')), '2026-09-08');
    assert.equal(fechaComercial(new Date('2027-01-01T02:59:59Z')), '2026-12-31');
    assert.equal(fechaComercial(new Date('2027-01-01T03:00:00Z')), '2027-01-01');
    assert.equal(diasComercialesDesde(new Date('2026-09-09T02:59:00Z'), new Date('2026-09-09T03:01:00Z')), 1);
});

test('model validates names, enums, optional fields and paired coordinates', async () => {
    for (const invalid of [{ nombre: ' ' }, { apellido: '' }, { nombre: 'a'.repeat(101) }, { telefono: 'a'.repeat(31) }, { categoria: 'invalid' }, { tipoCliente: 'invalid' }, { barrioId: 'bad' }, { latitud: 999, longitud: 0 }, { latitud: 0, longitud: null }]) {
        await assert.rejects(Cliente.build({ nombre: 'Name', apellido: 'Last', ...invalid }).validate());
    }
    const cliente = Cliente.build({ nombre: ' Name ', apellido: ' Last ', direccion: null, latitud: null, longitud: null });
    await cliente.validate();
    assert.equal(cliente.nombre, 'Name');
    assert.equal(cliente.direccion, null);
});

test('geocoding accepts only valid results and sends a timeout signal', async t => {
    t.mock.method(global, 'fetch', async (url, options) => {
        assert.ok(options.signal instanceof AbortSignal);
        assert.ok(new URL(url).searchParams.get('q').includes('Address'));
        return { ok: true, json: async () => [{ lat: '-24.2', lon: '-65.3' }] };
    });
    assert.deepEqual(await geocodificarDireccion('Address'), { latitud: -24.2, longitud: -65.3 });
});

test('geocoding handles empty, invalid, failed and aborted responses', async t => {
    t.mock.method(console, 'error', () => {});
    const fetchMock = t.mock.method(global, 'fetch', async () => ({ ok: false }));
    assert.equal(await geocodificarDireccion('Address'), null);
    for (const data of [[], {}, null, [{ lat: '', lon: '' }], [{ lat: '999', lon: '0' }], [{ lat: '1abc', lon: '2' }]]) {
        fetchMock.mock.mockImplementation(async () => ({ ok: true, json: async () => data }));
        assert.equal(await geocodificarDireccion('Address'), null);
    }
    fetchMock.mock.mockImplementation(async () => { throw new DOMException('timeout', 'TimeoutError'); });
    assert.equal(await geocodificarDireccion('Address'), null);
});
