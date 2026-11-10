const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize, ConnectionError } = require('sequelize');
const config = require('../config/config').development;
const databaseName = 'soderia_historial_test_' + randomBytes(8).toString('hex');
const adminDb = new Sequelize({ ...config, logging: false });
const db = new Sequelize({ ...config, database: databaseName, logging: false });
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
process.env.JWT_SECRET = 'historial-integration-tests-only';
require('../dist/models/associations');
const Historial = require('../dist/models/Historial').default;
const HistorialDetalle = require('../dist/models/HistorialDetalle').default;
const SaldoEnvase = require('../dist/models/SaldoEnvase').default;
const MovimientoStock = require('../dist/models/MovimientoStock').default;
const Producto = require('../dist/models/Producto').default;
const Cliente = require('../dist/models/Cliente').default;
const Usuario = require('../dist/models/Usuario').default;
const { crearSesion } = require('../dist/services/token.service');
const { fechaComercial } = require('../dist/utils/fecha-comercial');
let created = false, server, base, token, user, cliente, producto;
const absentId = '11111111-1111-4111-8111-111111111111';
const hex = () => randomBytes(4).toString('hex');
function assertScratch() {
    assert.match(databaseName, /^soderia_historial_test_[a-f0-9]{16}$/);
    assert.notEqual(databaseName, config.database); assert.equal(db.getDatabaseName(), databaseName);
}
async function request(url, method = 'GET', body, auth = true) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(base + url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
}
function crearProducto(extra = {}) {
    return Producto.create({ nombre: 'Producto ' + hex(), stockActual: 10, precioParticular: 100, precioConfianza: 90, ...extra });
}
const entrega = (extra = {}) => ({ clienteId: cliente.id, detalles: [{ productoId: producto.id, cantidadEntregada: 2, cantidadEnvaseDevuelto: 1 }], ...extra });
async function estado() {
    await cliente.reload(); await producto.reload();
    const envase = await SaldoEnvase.findOne({ where: { clienteId: cliente.id, productoId: producto.id } });
    return { saldo: cliente.saldoActual, stock: producto.stockActual, envases: envase ? envase.cantidad : null, visita: cliente.ultimaVisitaFecha,
        historiales: await Historial.count({ where: { clienteId: cliente.id } }), movimientos: await MovimientoStock.count({ where: { productoId: producto.id } }) };
}
before(async () => {
    assertScratch(); await adminDb.getQueryInterface().createDatabase(databaseName); created = true;
    const directory = path.join(__dirname, '../migrations');
    for (const file of fs.readdirSync(directory).filter(f => f.endsWith('.js')).sort()) await require(path.join(directory, file)).up(db.getQueryInterface(), Sequelize);
    user = await Usuario.create({ username: 'fixture', nombreCompleto: 'Fixture', email: 'fixture@example.com', passwordHash: 'unused-test-hash' });
    token = crearSesion(user);
    const app = express(); app.use(express.json());
    app.use('/api/historial', require('../dist/routes/historial.routes').default);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = 'http://127.0.0.1:' + server.address().port + '/api';
});
beforeEach(async () => {
    cliente = await Cliente.create({ nombre: 'Ana', apellido: 'Test ' + hex(), tipoCliente: 'particular' });
    producto = await crearProducto();
});
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.close();
    try { if (created) { assertScratch(); await adminDb.getQueryInterface().dropDatabase(databaseName); } }
    finally { await adminDb.close(); }
});

test('all history routes require authentication and client ids must be uuids', async () => {
    for (const route of ['/historial', '/historial/resumen', '/historial/resumen-hoy', '/historial/cliente/' + absentId]) assert.equal((await request(route, 'GET', undefined, false)).status, 401);
    assert.equal((await request('/historial', 'POST', undefined, false)).status, 401);
    assert.equal((await request('/historial/cliente/abc')).status, 400);
});
test('invalid deliveries are rejected with 400 and leave balances, stock and containers untouched', async () => {
    const antes = await estado();
    for (const body of [undefined, [], {}, { clienteId: 'abc', montoPagado: 10 }, { clienteId: cliente.id }, { clienteId: cliente.id, montoPagado: -50 },
        { clienteId: cliente.id, montoPagado: 'abc' }, entrega({ detalles: 'x' }), entrega({ detalles: [{ productoId: 'abc', cantidadEntregada: 1 }] }),
        entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: -2 }] }), entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: 1.5 }] }),
        entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: 'dos' }] }), entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: 1, precioUnitario: -100 }] }),
        entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: 1, cantidadEnvaseDevuelto: -3 }] }), entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: 0 }] }),
        entrega({ metodoPago: 'bitcoin' }), entrega({ observacion: 'x'.repeat(256) }),
        entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: 1 }, { productoId: producto.id, cantidadEntregada: 1 }] })]) {
        assert.equal((await request('/historial', 'POST', body)).status, 400, JSON.stringify(body));
    }
    assert.deepEqual(await estado(), antes);
});
test('missing clients or products give 404, inactive products and insufficient stock give 409, nothing is written', async () => {
    const antes = await estado();
    assert.equal((await request('/historial', 'POST', entrega({ clienteId: absentId }))).status, 404);
    assert.equal((await request('/historial', 'POST', entrega({ detalles: [{ productoId: absentId, cantidadEntregada: 1 }] }))).status, 404);
    let result = await request('/historial', 'POST', entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: 11 }] }));
    assert.equal(result.status, 409); assert.match(result.body.error, /Stock insuficiente/);
    await producto.update({ activo: false });
    assert.equal((await request('/historial', 'POST', entrega())).status, 409);
    await producto.update({ activo: true });
    await cliente.destroy();
    assert.equal((await request('/historial', 'POST', entrega())).status, 404);
    await cliente.restore();
    assert.deepEqual(await estado(), antes);
});
test('a delivery prices lines by client type, updates balance, stock, containers and visit, and returns numbers', async () => {
    await cliente.update({ saldoActual: 20 });
    const result = await request('/historial', 'POST', entrega({ montoPagado: 50, metodoPago: 'transferencia', observacion: '  Entrega  ' }));
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const { historial, detalles } = result.body;
    assert.equal(historial.saldoAnterior, 20); assert.equal(historial.importeTotal, 200); assert.equal(historial.montoPagado, 50); assert.equal(historial.saldoFinal, 170);
    assert.equal(historial.metodoPago, 'transferencia'); assert.equal(historial.observacion, 'Entrega'); assert.equal(historial.usuarioId, user.id);
    assert.equal(detalles.length, 1); assert.equal(detalles[0].precioUnitario, 100); assert.equal(detalles[0].importe, 200); assert.ok(detalles[0].id);
    const despues = await estado();
    assert.equal(despues.saldo, 170); assert.equal(despues.stock, 8); assert.equal(despues.envases, 1); assert.equal(despues.visita, fechaComercial());
    assert.equal(despues.movimientos, 1);
    const movimiento = await MovimientoStock.findOne({ where: { productoId: producto.id } });
    assert.equal(movimiento.tipo, 'salida'); assert.equal(movimiento.cantidad, 2); assert.equal(movimiento.usuarioId, user.id);
    await cliente.update({ tipoCliente: 'confianza' });
    const confianza = await request('/historial', 'POST', entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: 1 }] }));
    assert.equal(confianza.body.detalles[0].precioUnitario, 90); assert.equal(confianza.body.historial.saldoFinal, 260);
});
test('manual prices, payment-only visits and container returns are handled and rounded to cents', async () => {
    let result = await request('/historial', 'POST', entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: 3, precioUnitario: 33.33 }] }));
    assert.equal(result.status, 201); assert.equal(result.body.historial.importeTotal, 99.99); assert.equal(result.body.detalles[0].importe, 99.99);
    result = await request('/historial', 'POST', { clienteId: cliente.id, montoPagado: 99.99 });
    assert.equal(result.status, 201); assert.equal(result.body.historial.saldoFinal, 0); assert.deepEqual(result.body.detalles, []);
    result = await request('/historial', 'POST', entrega({ detalles: [{ productoId: producto.id, cantidadEnvaseDevuelto: 2 }] }));
    assert.equal(result.status, 201); assert.equal(result.body.historial.importeTotal, 0);
    const despues = await estado();
    assert.equal(despues.saldo, 0); assert.equal(despues.stock, 7); assert.equal(despues.envases, 1); assert.equal(despues.movimientos, 1);
});
test('non returnable products never create container balances and reject returned containers', async () => {
    const descartable = await crearProducto({ esRetornable: false });
    assert.equal((await request('/historial', 'POST', entrega({ detalles: [{ productoId: descartable.id, cantidadEntregada: 1, cantidadEnvaseDevuelto: 1 }] }))).status, 400);
    const result = await request('/historial', 'POST', entrega({ detalles: [{ productoId: descartable.id, cantidadEntregada: 2 }] }));
    assert.equal(result.status, 201);
    assert.equal(await SaldoEnvase.count({ where: { clienteId: cliente.id, productoId: descartable.id } }), 0);
    await descartable.reload(); assert.equal(descartable.stockActual, 8);
});
test('concurrent deliveries never oversell stock and balances stay consistent', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => request('/historial', 'POST', entrega({ detalles: [{ productoId: producto.id, cantidadEntregada: 4 }] }))));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 201, 409, 409]);
    const despues = await estado();
    assert.equal(despues.stock, 2); assert.equal(despues.saldo, 800); assert.equal(despues.historiales, 2); assert.equal(despues.envases, 8);
});
test('per-client history validates filters, paginates, includes details and stays visible for archived clients', async () => {
    assert.equal((await request('/historial/cliente/' + absentId)).status, 404);
    for (const query of ['page=abc', 'limit=0', 'limit=501', 'desde=abc']) assert.equal((await request('/historial/cliente/' + cliente.id + '?' + query)).status, 400);
    await request('/historial', 'POST', entrega());
    await request('/historial', 'POST', { clienteId: cliente.id, montoPagado: 10 });
    let result = await request('/historial/cliente/' + cliente.id);
    assert.equal(result.status, 200); assert.equal(result.body.length, 2); assert.equal(result.headers.get('x-total-historial'), '2');
    assert.equal(result.body[0].montoPagado, 10); assert.equal(result.body[1].detalles[0].producto.nombre, producto.nombre); assert.equal(typeof result.body[1].importeTotal, 'number');
    result = await request('/historial/cliente/' + cliente.id + '?limit=1&page=2');
    assert.equal(result.body.length, 1); assert.equal(result.body[0].importeTotal, 200); assert.equal(result.headers.get('x-total-historial'), '2');
    await cliente.update({ saldoActual: 0 }); await cliente.destroy();
    result = await request('/historial/cliente/' + cliente.id); assert.equal(result.status, 200); assert.equal(result.body.length, 2);
});
test('global listing paginates, filters by ISO instants or commercial days and rejects bad input', async () => {
    for (const query of ['page=abc', 'page=0', 'limit=-5', 'limit=101', 'desde=abc', 'desde=2026-02-01&hasta=2026-01-01']) assert.equal((await request('/historial?' + query)).status, 400);
    const fields = { clienteId: cliente.id, usuarioId: user.id, saldoAnterior: 0, importeTotal: 10, montoPagado: 0, saldoFinal: 10 };
    const enero = await Historial.create({ ...fields, fecha: new Date('2026-01-15T12:00:00-03:00') });
    const finEnero = await Historial.create({ ...fields, fecha: new Date('2026-01-31T23:30:00-03:00') });
    const febrero = await Historial.create({ ...fields, fecha: new Date('2026-02-01T00:30:00-03:00') });
    let result = await request('/historial?desde=2026-01-01&hasta=2026-01-31&limit=100');
    assert.equal(result.status, 200); assert.equal(result.body.total, 2); assert.deepEqual(result.body.data.map(h => h.id), [finEnero.id, enero.id]);
    assert.equal(result.body.data[0].cliente.id, cliente.id); assert.equal(result.body.data[0].usuario.nombreCompleto, 'Fixture'); assert.equal(typeof result.body.data[0].importeTotal, 'number');
    result = await request('/historial?desde=2026-02-01T00:00:00-03:00&hasta=2026-02-28&limit=100');
    assert.deepEqual(result.body.data.map(h => h.id), [febrero.id]);
    result = await request('/historial?desde=2026-01-01&hasta=2026-02-28&limit=1&page=3');
    assert.equal(result.body.total, 3); assert.equal(result.body.totalPages, 3); assert.equal(result.body.page, 3); assert.deepEqual(result.body.data.map(h => h.id), [enero.id]);
});
test('summaries aggregate the period and today follows the Argentine commercial day', async t => {
    for (const query of ['desde=abc', 'desde=2026-02-01&hasta=2026-01-01']) assert.equal((await request('/historial/resumen?' + query)).status, 400);
    const otro = await crearProducto();
    const dia = '2030-03-10';
    t.mock.timers.enable({ apis: ['Date'], now: new Date(dia + 'T23:30:00-03:00') });
    // La sesion se emite con el reloj simulado; si no, el token de 2026 llega vencido a 2030.
    const tokenReal = token; token = crearSesion(user); t.after(() => { token = tokenReal; });
    await request('/historial', 'POST', entrega({ montoPagado: 50, metodoPago: 'transferencia', detalles: [{ productoId: producto.id, cantidadEntregada: 2, cantidadEnvaseDevuelto: 1 }, { productoId: otro.id, cantidadEntregada: 1 }] }));
    await request('/historial', 'POST', { clienteId: cliente.id, montoPagado: 25.5 });
    const fuera = await Historial.create({ clienteId: cliente.id, usuarioId: user.id, saldoAnterior: 0, importeTotal: 1000, montoPagado: 1000, saldoFinal: 0, fecha: new Date('2030-03-11T00:10:00-03:00') });
    let result = await request('/historial/resumen?desde=' + dia + '&hasta=' + dia);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { cantidadEntregas: 2, totalImporte: 300, totalPagado: 75.5, totalPendiente: 224.5,
        productos: [{ nombre: otro.nombre, cantidad: 1, devueltos: 0 }, { nombre: producto.nombre, cantidad: 2, devueltos: 1 }].sort((a, b) => a.nombre.localeCompare(b.nombre)) });
    result = await request('/historial/resumen-hoy');
    assert.equal(result.body.fecha, dia); assert.equal(result.body.cobrado, 75.5); assert.equal(result.body.entregasCount, 2); assert.equal(result.body.entregados, 3); assert.equal(result.body.devueltos, 1);
    assert.deepEqual(result.body.cobradoPorMetodo, { efectivo: 25.5, transferencia: 50, mercadopago: 0 });
    assert.ok(!result.body.productos.some(p => p.cantidad === 1000));
    t.mock.timers.setTime(new Date('2030-03-11T00:20:00-03:00').getTime());
    result = await request('/historial/resumen-hoy');
    assert.equal(result.body.fecha, '2030-03-11'); assert.equal(result.body.cobrado, 1000); assert.equal(result.body.entregasCount, 1); assert.ok(fuera.id);
    assert.deepEqual(result.body.cobradoPorMetodo, { efectivo: 1000, transferencia: 0, mercadopago: 0 });
});
test('database connection failures return 503 and query failures 500', async t => {
    t.mock.method(console, 'error', () => {});
    const finder = t.mock.method(Historial, 'findAndCountAll', async () => { throw new ConnectionError(new Error('offline')); });
    assert.equal((await request('/historial')).status, 503);
    finder.mock.mockImplementation(async () => { throw new Error('query error'); });
    assert.equal((await request('/historial')).status, 500);
});
test('prior debt is audited with the delivery and does not inflate sales or payments', async () => {
    const beforeSummary = (await request('/historial/resumen')).body;
    const ajusteSaldo = { saldoEsperado: 0, saldoNuevo: 15000, motivo: 'Deuda anterior al sistema' };
    const result = await request('/historial', 'POST', entrega({ montoPagado: 50, ajusteSaldo }));
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.historial.saldoAnterior, 15000);
    assert.equal(result.body.historial.saldoFinal, 15150);
    assert.deepEqual(result.body.historial.ajusteSaldo, ajusteSaldo);
    assert.equal(result.body.historial.usuarioId, user.id);
    assert.ok(result.body.historial.fecha);
    assert.equal((await estado()).saldo, 15150);
    const history = (await request('/historial/cliente/' + cliente.id)).body;
    assert.deepEqual(history[0].ajusteSaldo, ajusteSaldo);
    const afterSummary = (await request('/historial/resumen')).body;
    assert.equal(afterSummary.cantidadEntregas - beforeSummary.cantidadEntregas, 1);
    assert.equal(afterSummary.totalImporte - beforeSummary.totalImporte, 200);
    assert.equal(afterSummary.totalPagado - beforeSummary.totalPagado, 50);
    assert.equal(afterSummary.totalPendiente - beforeSummary.totalPendiente, 150);
});

test('a stale balance adjustment cannot overwrite a more recent payment', async () => {
    await cliente.update({ saldoActual: 500 });
    assert.equal((await request('/historial', 'POST', { clienteId: cliente.id, montoPagado: 100 })).status, 201);
    const before = await estado();
    const result = await request('/historial', 'POST', entrega({ ajusteSaldo: { saldoEsperado: 500, saldoNuevo: 15000, motivo: 'Deuda previa' } }));
    assert.equal(result.status, 409);
    assert.match(result.body.error, /saldo del cliente cambio/);
    assert.deepEqual(await estado(), before);
});

test('concurrent balance adjustments serialize and only one matching expected balance succeeds', async () => {
    const ajusteSaldo = { saldoEsperado: 0, saldoNuevo: 15000, motivo: 'Deuda previa' };
    const results = await Promise.all([
        request('/historial', 'POST', entrega({ ajusteSaldo })),
        request('/historial', 'POST', entrega({ ajusteSaldo })),
    ]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    const saved = await estado();
    assert.equal(saved.saldo, 15200); assert.equal(saved.historiales, 1); assert.equal(saved.stock, 8);
});

test('a failed delivery rolls back the adjustment audit, balance, stock and containers', async t => {
    const before = await estado();
    t.mock.method(console, 'error', () => {});
    t.mock.method(MovimientoStock, 'create', async () => { throw new Error('simulated stock write failure'); });
    const result = await request('/historial', 'POST', entrega({ ajusteSaldo: { saldoEsperado: 0, saldoNuevo: 15000, motivo: 'Deuda previa' } }));
    assert.equal(result.status, 500);
    assert.deepEqual(await estado(), before);
});

test('invalid adjustments and overflowing final balances leave the delivery unchanged', async () => {
    const before = await estado();
    for (const ajusteSaldo of [null, { saldoEsperado: 0, saldoNuevo: -10, motivo: 'Deuda' },
        { saldoEsperado: 0, saldoNuevo: 100, motivo: '' }, { saldoEsperado: 0, saldoNuevo: 99999999.99, motivo: 'Deuda' }]) {
        assert.equal((await request('/historial', 'POST', entrega({ ajusteSaldo }))).status, 400);
    }
    assert.deepEqual(await estado(), before);
});
