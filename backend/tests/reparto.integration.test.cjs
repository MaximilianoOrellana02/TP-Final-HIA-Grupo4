const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');
const config = require('../config/config').development;
const databaseName = 'soderia_reparto_test_' + randomBytes(8).toString('hex');
const adminDb = new Sequelize({ ...config, logging: false });
const db = new Sequelize({ ...config, database: databaseName, logging: false });
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
process.env.JWT_SECRET = 'reparto-integration-tests-only';
require('../dist/models/associations');
const Reparto = require('../dist/models/Reparto').default;
const Producto = require('../dist/models/Producto').default;
const Cliente = require('../dist/models/Cliente').default;
const Usuario = require('../dist/models/Usuario').default;
const { crearSesion } = require('../dist/services/token.service');
let created = false, server, base, token, producto, cliente;
const hex = () => randomBytes(4).toString('hex');
function assertScratch() {
    assert.match(databaseName, /^soderia_reparto_test_[a-f0-9]{16}$/);
    assert.notEqual(databaseName, config.database); assert.equal(db.getDatabaseName(), databaseName);
}
async function request(url, method = 'GET', body, auth = token) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = 'Bearer ' + auth;
    const response = await fetch(base + url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
}

before(async () => {
    assertScratch(); await adminDb.getQueryInterface().createDatabase(databaseName); created = true;
    const directory = path.join(__dirname, '../migrations');
    for (const file of fs.readdirSync(directory).filter(f => f.endsWith('.js')).sort()) await require(path.join(directory, file)).up(db.getQueryInterface(), Sequelize);
    const app = express(); app.use(express.json());
    app.use('/api/repartos', require('../dist/routes/reparto.routes').default);
    app.use('/api/historial', require('../dist/routes/historial.routes').default);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = 'http://127.0.0.1:' + server.address().port + '/api';
});
// Un usuario nuevo por test: hay un solo reparto por usuario y día.
beforeEach(async () => {
    const n = hex();
    token = crearSesion(await Usuario.create({ username: 'u' + n, nombreCompleto: 'Repartidor ' + n, email: n + '@example.com', passwordHash: 'unused' }));
    producto = await Producto.create({ nombre: 'Bidón ' + n, stockActual: 20, precioParticular: 100, precioConfianza: 90 });
    cliente = await Cliente.create({ nombre: 'Ana', apellido: 'Test ' + n, tipoCliente: 'particular' });
});
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.close();
    try { if (created) { assertScratch(); await adminDb.getQueryInterface().dropDatabase(databaseName); } }
    finally { await adminDb.close(); }
});

test('reparto routes require authentication', async () => {
    for (const [url, method] of [['/repartos/hoy', 'GET'], ['/repartos/hoy/comenzar', 'POST'], ['/repartos/hoy/terminar', 'POST']]) {
        assert.equal((await request(url, method, undefined, null)).status, 401);
    }
});

test('there is no reparto until it starts, and it cannot end before starting', async () => {
    assert.deepEqual((await request('/repartos/hoy')).body, { reparto: null, resumen: null });
    const result = await request('/repartos/hoy/terminar', 'POST');
    assert.equal(result.status, 404); assert.match(result.body.error, /comenzaste/);
});

test('starting is idempotent: one reparto per driver and day', async () => {
    const result = await request('/repartos/hoy/comenzar', 'POST');
    assert.equal(result.status, 201); assert.equal(result.body.finalizadoEn, null);
    assert.equal((await request('/repartos/hoy/comenzar', 'POST')).status, 201);
    assert.equal(await Reparto.count({ where: { usuarioId: result.body.usuarioId } }), 1);
});

test('ending returns the day summary of that driver and blocks a second start or end', async () => {
    await request('/repartos/hoy/comenzar', 'POST');
    // Paga 150 de 200 en efectivo: quedan 50 fiados.
    const entrega = await request('/historial', 'POST', { clienteId: cliente.id, montoPagado: 150, metodoPago: 'efectivo', detalles: [{ productoId: producto.id, cantidadEntregada: 2, cantidadEnvaseDevuelto: 0 }] });
    assert.equal(entrega.status, 201);

    const result = await request('/repartos/hoy/terminar', 'POST');
    assert.equal(result.status, 200);
    assert.ok(result.body.reparto.finalizadoEn);
    const r = result.body.resumen;
    assert.equal(r.entregas, 1); assert.equal(r.totalVendido, 200); assert.equal(r.cobrado, 150); assert.equal(r.fiado, 50);
    assert.deepEqual(r.cobradoPorMetodo, { efectivo: 150, transferencia: 0, mercadopago: 0 });
    assert.deepEqual(r.productos, [{ nombre: producto.nombre, cantidad: 2, devueltos: 0 }]);
    assert.equal((await Producto.findByPk(producto.id)).stockActual, 18);

    assert.equal((await request('/repartos/hoy/terminar', 'POST')).status, 409);
    assert.equal((await request('/repartos/hoy/comenzar', 'POST')).status, 409);
    const hoy = (await request('/repartos/hoy')).body;
    assert.ok(hoy.reparto.finalizadoEn); assert.equal(hoy.resumen.entregas, 1);
});

test('cancelling the end reopens the reparto so it can be ended again', async () => {
    assert.equal((await request('/repartos/hoy/reabrir', 'POST')).status, 404);
    await request('/repartos/hoy/comenzar', 'POST');
    assert.equal((await request('/repartos/hoy/reabrir', 'POST')).status, 409);
    await request('/repartos/hoy/terminar', 'POST');

    const result = await request('/repartos/hoy/reabrir', 'POST');
    assert.equal(result.status, 200); assert.equal(result.body.finalizadoEn, null);
    assert.deepEqual((await request('/repartos/hoy')).body.resumen, null);
    // Sigue siendo el mismo reparto (misma hora de inicio) y se puede volver a terminar.
    const ended = await request('/repartos/hoy/terminar', 'POST');
    assert.equal(ended.status, 200); assert.equal(ended.body.reparto.iniciadoEn, result.body.iniciadoEn);
});

test('the summary only counts the deliveries of that driver', async () => {
    const otro = crearSesion(await Usuario.create({ username: 'o' + hex(), nombreCompleto: 'Otro', email: hex() + '@example.com', passwordHash: 'unused' }));
    await request('/historial', 'POST', { clienteId: cliente.id, montoPagado: 0, detalles: [{ productoId: producto.id, cantidadEntregada: 1 }] }, otro);
    await request('/repartos/hoy/comenzar', 'POST');
    const r = (await request('/repartos/hoy/terminar', 'POST')).body.resumen;
    assert.equal(r.entregas, 0); assert.equal(r.totalVendido, 0); assert.deepEqual(r.productos, []);
});
