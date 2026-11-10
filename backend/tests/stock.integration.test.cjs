const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize, ConnectionError } = require('sequelize');
const config = require('../config/config').development;
const databaseName = 'soderia_stock_test_' + randomBytes(8).toString('hex');
const adminDb = new Sequelize({ ...config, logging: false });
const db = new Sequelize({ ...config, database: databaseName, logging: false });
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
process.env.JWT_SECRET = 'stock-integration-tests-only';
require('../dist/models/associations');
const Producto = require('../dist/models/Producto').default;
const MovimientoStock = require('../dist/models/MovimientoStock').default;
const Usuario = require('../dist/models/Usuario').default;
const { crearSesion } = require('../dist/services/token.service');
let created = false, server, base, token, producto;
const absentId = '11111111-1111-4111-8111-111111111111';
const uniqueName = () => 'Producto ' + randomBytes(8).toString('hex');
function assertScratch() {
    assert.match(databaseName, /^soderia_stock_test_[a-f0-9]{16}$/);
    assert.notEqual(databaseName, config.database); assert.equal(db.getDatabaseName(), databaseName);
}
async function request(url, method = 'GET', body, auth = true) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(base + url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
}
const movimiento = (extra = {}) => ({ productoId: producto.id, tipo: 'entrada', cantidad: 5, ...extra });
before(async () => {
    assertScratch(); await adminDb.getQueryInterface().createDatabase(databaseName); created = true;
    const directory = path.join(__dirname, '../migrations');
    for (const file of fs.readdirSync(directory).filter(f => f.endsWith('.js')).sort()) await require(path.join(directory, file)).up(db.getQueryInterface(), Sequelize);
    const user = await Usuario.create({ username: 'fixture', nombreCompleto: 'Fixture', email: 'fixture@example.com', passwordHash: 'unused-test-hash' });
    token = crearSesion(user);
    const app = express(); app.use(express.json());
    app.use('/api/stock', require('../dist/routes/stock.routes').default);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = 'http://127.0.0.1:' + server.address().port + '/api';
});
beforeEach(async () => { producto = await Producto.create({ precioParticular: 100, precioConfianza: 90, nombre: uniqueName(), stockActual: 10 }); });
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.close();
    try { if (created) { assertScratch(); await adminDb.getQueryInterface().dropDatabase(databaseName); } }
    finally { await adminDb.close(); }
});

test('all stock routes require authentication', async () => {
    for (const [route, method] of [['/stock/movimientos', 'GET'], ['/stock/movimientos', 'POST']]) assert.equal((await request(route, method, undefined, false)).status, 401);
});
test('create rejects malformed bodies with 400 and unknown products with 404 without touching stock', async () => {
    const before = await MovimientoStock.count();
    for (const body of [undefined, [], {}, movimiento({ productoId: 'abc' }), movimiento({ tipo: 'ajuste' }), movimiento({ cantidad: 0 }),
        movimiento({ cantidad: 1.5 }), movimiento({ cantidad: '5' }), movimiento({ tipo: 'salida' }), movimiento({ tipo: 'salida', motivo: '  ' }),
        movimiento({ motivo: 'x'.repeat(256) })]) {
        assert.equal((await request('/stock/movimientos', 'POST', body)).status, 400);
    }
    assert.equal((await request('/stock/movimientos', 'POST', movimiento({ productoId: absentId }))).status, 404);
    assert.equal(await MovimientoStock.count(), before); await producto.reload(); assert.equal(producto.stockActual, 10);
});
test('entries and exits adjust stock, trim reasons and return the resulting stock', async () => {
    let result = await request('/stock/movimientos', 'POST', movimiento({ cantidad: 7, motivo: ' Compra ' }));
    assert.equal(result.status, 201); assert.equal(result.body.stockActual, 17); assert.equal(result.body.motivo, 'Compra'); assert.equal(result.body.tipo, 'entrada');
    result = await request('/stock/movimientos', 'POST', movimiento({ tipo: 'salida', cantidad: 17, motivo: 'Rotura' }));
    assert.equal(result.status, 201); assert.equal(result.body.stockActual, 0);
    await producto.reload(); assert.equal(producto.stockActual, 0);
    assert.equal(await MovimientoStock.count({ where: { productoId: producto.id } }), 2);
});
test('exits never leave negative stock and inactive products reject movements', async () => {
    let result = await request('/stock/movimientos', 'POST', movimiento({ tipo: 'salida', cantidad: 11, motivo: 'Rotura' }));
    assert.equal(result.status, 409); assert.match(result.body.error, /insuficiente/);
    await producto.update({ activo: false });
    for (const tipo of ['entrada', 'salida']) assert.equal((await request('/stock/movimientos', 'POST', movimiento({ tipo, cantidad: 1, motivo: 'x' }))).status, 409);
    await producto.reload(); assert.equal(producto.stockActual, 10); assert.equal(await MovimientoStock.count({ where: { productoId: producto.id } }), 0);
});
test('concurrent exits are serialized and stock stays consistent with the recorded movements', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => request('/stock/movimientos', 'POST', movimiento({ tipo: 'salida', cantidad: 4, motivo: 'Venta' }))));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 201, 409, 409]);
    await producto.reload(); assert.equal(producto.stockActual, 2);
    assert.equal(await MovimientoStock.sum('cantidad', { where: { productoId: producto.id, tipo: 'salida' } }), 8);
});
test('listing validates filters, applies them and orders newest first', async () => {
    for (const query of ['productoId=abc', 'tipo=otro', 'desde=abc', 'desde=2026-02-01&hasta=2026-01-01']) assert.equal((await request('/stock/movimientos?' + query)).status, 400);
    await request('/stock/movimientos', 'POST', movimiento({ cantidad: 1 }));
    await request('/stock/movimientos', 'POST', movimiento({ tipo: 'salida', cantidad: 2, motivo: 'Rotura' }));
    let result = await request('/stock/movimientos?productoId=' + producto.id);
    assert.equal(result.status, 200); assert.equal(result.headers.get('x-limite-movimientos'), '1000');
    assert.deepEqual(result.body.map(m => m.tipo), ['salida', 'entrada']);
    assert.equal(result.body[0].producto.nombre, producto.nombre); assert.equal(result.body[0].usuario.nombreCompleto, 'Fixture');
    result = await request('/stock/movimientos?productoId=' + producto.id + '&tipo=entrada'); assert.deepEqual(result.body.map(m => m.cantidad), [1]);
    result = await request('/stock/movimientos?productoId=' + producto.id + '&hasta=2000-01-01'); assert.deepEqual(result.body, []);
    result = await request('/stock/movimientos?productoId=' + producto.id + '&desde=2000-01-01'); assert.equal(result.body.length, 2);
});
test('database connection failures return 503 and query failures 500', async t => {
    t.mock.method(console, 'error', () => {});
    const finder = t.mock.method(MovimientoStock, 'findAll', async () => { throw new ConnectionError(new Error('offline')); });
    assert.equal((await request('/stock/movimientos')).status, 503);
    finder.mock.mockImplementation(async () => { throw new Error('query error'); });
    assert.equal((await request('/stock/movimientos')).status, 500);
});