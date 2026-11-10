const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize, ConnectionError } = require('sequelize');
const config = require('../config/config').development;
const databaseName = 'soderia_barrio_test_' + randomBytes(8).toString('hex');
const adminDb = new Sequelize({ ...config, logging: false });
const db = new Sequelize({ ...config, database: databaseName, logging: false });
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
process.env.JWT_SECRET = 'barrio-integration-tests-only';
require('../dist/models/associations');
const Barrio = require('../dist/models/Barrio').default;
const Cliente = require('../dist/models/Cliente').default;
const Usuario = require('../dist/models/Usuario').default;
const { crearSesion } = require('../dist/services/token.service');
const migration = require('../migrations/20260908020000-harden-barrios');
let created = false, server, base, token, barrio;
const absentId = '11111111-1111-4111-8111-111111111111';
const uniqueName = () => 'Barrio ' + randomBytes(8).toString('hex');
function assertScratch() {
    assert.match(databaseName, /^soderia_barrio_test_[a-f0-9]{16}$/);
    assert.notEqual(databaseName, config.database); assert.equal(db.getDatabaseName(), databaseName);
}
async function request(url, method = 'GET', body, auth = true) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(base + url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
}
const url = () => '/barrios/' + barrio.id;
async function rawBarrio(nombre, diasVisita = []) {
    const id = randomUUID();
    await db.query('INSERT INTO barrios (id,nombre,diasVisita,createdAt,updatedAt) VALUES (:id,:nombre,:dias,NOW(),NOW())', { replacements: { id, nombre, dias: JSON.stringify(diasVisita) } });
    return id;
}
before(async () => {
    assertScratch(); await adminDb.getQueryInterface().createDatabase(databaseName); created = true;
    const directory = path.join(__dirname, '../migrations');
    for (const file of fs.readdirSync(directory).filter(f => f.endsWith('.js')).sort()) await require(path.join(directory, file)).up(db.getQueryInterface(), Sequelize);
    const user = await Usuario.create({ username: 'fixture', nombreCompleto: 'Fixture', email: 'fixture@example.com', passwordHash: 'unused-test-hash' });
    token = crearSesion(user);
    const app = express(); app.use(express.json());
    app.use('/api/barrios', require('../dist/routes/barrio.routes').default);
    app.use('/api/clientes', require('../dist/routes/cliente.routes').default);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = 'http://127.0.0.1:' + server.address().port + '/api';
});
beforeEach(async () => { barrio = await Barrio.create({ nombre: uniqueName(), diasVisita: ['lunes'] }); });
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.close();
    try { if (created) { assertScratch(); await adminDb.getQueryInterface().dropDatabase(databaseName); } }
    finally { await adminDb.close(); }
});

test('all barrio routes require authentication', async () => {
    for (const [route, method] of [['/barrios', 'GET'], ['/barrios', 'POST'], [url(), 'PUT'], [url(), 'DELETE']]) assert.equal((await request(route, method, undefined, false)).status, 401);
});
test('ids distinguish malformed 400 from missing 404', async () => {
    for (const method of ['PUT', 'DELETE']) {
        assert.equal((await request('/barrios/invalid', method, { nombre: 'Name' })).status, 400);
        assert.equal((await request('/barrios/' + absentId, method, { nombre: 'Name' })).status, 404);
    }
});
test('create rejects malformed bodies, names and visit days with 400', async () => {
    const beforeCount = await Barrio.count();
    for (const body of [undefined, [], {}, { nombre: 123 }, { nombre: ' ' }, { nombre: 'x'.repeat(101) }, ...['lunes', {}, [123, null], ['invalid'], ['lunes', 'lunes'], null].map(diasVisita => ({ nombre: uniqueName(), diasVisita }))]) {
        assert.equal((await request('/barrios', 'POST', body)).status, 400);
    }
    assert.equal(await Barrio.count(), beforeCount);
});
test('create trims names and persists a valid default array', async () => {
    const nombre = uniqueName();
    const result = await request('/barrios', 'POST', { nombre: ' ' + nombre + ' ' });
    assert.equal(result.status, 201); assert.equal(result.body.nombre, nombre); assert.deepEqual(result.body.diasVisita, []);
    assert.deepEqual((await Barrio.findByPk(result.body.id)).diasVisita, []);
});
test('duplicate creates and renames return 409 including normalized names', async () => {
    const other = await Barrio.create({ nombre: uniqueName() });
    for (const nombre of [barrio.nombre, ' ' + barrio.nombre + ' ', barrio.nombre.toUpperCase()]) {
        assert.equal((await request('/barrios', 'POST', { nombre })).status, 409);
        assert.equal((await request('/barrios/' + other.id, 'PUT', { nombre })).status, 409);
    }
    await other.reload(); assert.notEqual(other.nombre, barrio.nombre);
});
test('update rejects malformed, empty and null bodies without changing existing data', async () => {
    for (const body of [undefined, [], {}, { nombre: '' }, { nombre: null }, { nombre: 123 }, { nombre: 'x'.repeat(101) }, { diasVisita: {} }, { diasVisita: null }, { diasVisita: ['lunes', 'lunes'] }]) assert.equal((await request(url(), 'PUT', body)).status, 400);
    await barrio.reload(); assert.deepEqual(barrio.diasVisita, ['lunes']);
});
test('partial updates preserve other fields and empty days clear the schedule', async () => {
    const original = barrio.nombre;
    let result = await request(url(), 'PUT', { diasVisita: ['martes', 'sabado'] });
    assert.equal(result.status, 200); assert.equal(result.body.nombre, original);
    const nombre = uniqueName(); result = await request(url(), 'PUT', { nombre });
    assert.deepEqual(result.body.diasVisita, ['martes', 'sabado']);
    result = await request(url(), 'PUT', { diasVisita: [] });
    assert.equal(result.status, 200); assert.deepEqual(result.body.diasVisita, []);
});
test('concurrent creates and renames cannot produce duplicates or 500 responses', async () => {
    const nombre = uniqueName();
    let results = await Promise.all([request('/barrios', 'POST', { nombre }), request('/barrios', 'POST', { nombre: ' ' + nombre })]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    const other = await Barrio.create({ nombre: uniqueName() }); const target = uniqueName();
    results = await Promise.all([request(url(), 'PUT', { nombre: target }), request('/barrios/' + other.id, 'PUT', { nombre: target })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
});
test('concurrent partial updates retain both changes', async () => {
    const nombre = uniqueName();
    const results = await Promise.all([request(url(), 'PUT', { nombre }), request(url(), 'PUT', { diasVisita: ['viernes'] })]);
    assert.deepEqual(results.map(r => r.status), [200, 200]); await barrio.reload();
    assert.equal(barrio.nombre, nombre); assert.deepEqual(barrio.diasVisita, ['viernes']);
});
test('delete blocks active clients without unlinking them', async () => {
    const cliente = await Cliente.create({ nombre: 'Active', apellido: 'Fixture', barrioId: barrio.id });
    assert.equal((await request(url(), 'DELETE')).status, 409);
    await cliente.reload(); assert.equal(cliente.barrioId, barrio.id); assert.ok(await Barrio.findByPk(barrio.id));
});
test('delete unlinks archived clients so no barrio becomes undeletable', async () => {
    const cliente = await Cliente.create({ nombre: 'Archived', apellido: 'Fixture', barrioId: barrio.id }); await cliente.destroy();
    assert.equal((await request(url(), 'DELETE')).status, 204);
    assert.equal(await Barrio.findByPk(barrio.id), null);
    const archived = await Cliente.findByPk(cliente.id, { paranoid: false });
    assert.equal(archived.barrioId, null); assert.ok(archived.deletedAt);
});
test('delete keeps archived clients linked when an active client blocks it', async () => {
    const archived = await Cliente.create({ nombre: 'Archived', apellido: 'Fixture', barrioId: barrio.id }); await archived.destroy();
    await Cliente.create({ nombre: 'Active', apellido: 'Fixture', barrioId: barrio.id });
    assert.equal((await request(url(), 'DELETE')).status, 409);
    assert.equal((await Cliente.findByPk(archived.id, { paranoid: false })).barrioId, barrio.id);
});
test('duplicate detection ignores case without relying on table collation', async () => {
    const other = await Barrio.create({ nombre: uniqueName() });
    const mixed = barrio.nombre.replace(/^Barrio/, 'bARRIO');
    assert.equal((await request('/barrios', 'POST', { nombre: mixed })).status, 409);
    assert.equal((await request('/barrios/' + other.id, 'PUT', { nombre: mixed })).status, 409);
    assert.equal((await request(url(), 'PUT', { nombre: mixed })).status, 200);
    await barrio.reload(); assert.equal(barrio.nombre, mixed);
});
test('visit days are returned in week order regardless of submission order', async () => {
    const result = await request(url(), 'PUT', { diasVisita: ['domingo', 'lunes', 'jueves'] });
    assert.equal(result.status, 200); assert.deepEqual(result.body.diasVisita, ['lunes', 'jueves', 'domingo']);
});
test('unassigned barrios can be deleted and active clients can be reassigned first', async () => {
    const cliente = await Cliente.create({ nombre: 'Client', apellido: 'Fixture', barrioId: barrio.id });
    assert.equal((await request('/clientes/' + cliente.id, 'PUT', { barrioId: null })).status, 200);
    assert.equal((await request(url(), 'DELETE')).status, 204);
    assert.equal((await request(url(), 'DELETE')).status, 404);
    assert.equal(await Barrio.findByPk(barrio.id), null);
});
test('database restriction protects clients even when the application count is stale', async t => {
    const cliente = await Cliente.create({ nombre: 'Client', apellido: 'Fixture', barrioId: barrio.id });
    t.mock.method(Cliente, 'count', async () => 0);
    assert.equal((await request(url(), 'DELETE')).status, 409);
    await cliente.reload(); assert.equal(cliente.barrioId, barrio.id);
    await assert.rejects(barrio.destroy(), { name: 'SequelizeForeignKeyConstraintError' });
});
test('concurrent assignment and deletion never silently unlink a client', async () => {
    const [deleted, assigned] = await Promise.all([
        request(url(), 'DELETE'),
        request('/clientes', 'POST', { nombre: 'Race', apellido: 'Fixture', barrioId: barrio.id }),
    ]);
    if (assigned.status === 201) {
        assert.equal(deleted.status, 409);
        assert.equal((await Cliente.findByPk(assigned.body.id)).barrioId, barrio.id);
    } else {
        assert.equal(deleted.status, 204); assert.ok([400, 409].includes(assigned.status));
    }
});
test('database connection failures return 503 and query failures 500', async t => {
    t.mock.method(console, 'error', () => {});
    const finder = t.mock.method(Barrio, 'findAll', async () => { throw new ConnectionError(new Error('offline')); });
    assert.equal((await request('/barrios')).status, 503);
    finder.mock.mockImplementation(async () => { throw new Error('query error'); });
    assert.equal((await request('/barrios')).status, 500);
});
test('listing sorts names and returns consistent arrays', async () => {
    const prefix = uniqueName();
    await Barrio.create({ nombre: prefix + ' B' }); await Barrio.create({ nombre: prefix + ' A' });
    const result = await request('/barrios'); assert.equal(result.status, 200);
    assert.deepEqual(result.body.filter(b => b.nombre.startsWith(prefix)).map(b => b.nombre), [prefix + ' A', prefix + ' B']);
    assert.ok(result.body.every(b => Array.isArray(b.diasVisita)));
});
test('migration can be retried, rolled back and reapplied with existing associations', async () => {
    const qi = db.getQueryInterface();
    await migration.up(qi); await migration.down(qi); await migration.up(qi);
    const [rules] = await db.query("SELECT DELETE_RULE AS accion FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'clientes' AND REFERENCED_TABLE_NAME = 'barrios'");
    assert.equal(rules[0].accion, 'RESTRICT');
});
test('migration normalizes legacy names without losing visit days', async () => {
    const nombre = uniqueName(); const id = await rawBarrio(' ' + nombre + ' ', ['miercoles']);
    await migration.up(db.getQueryInterface());
    const saved = await Barrio.findByPk(id); assert.equal(saved.nombre, nombre); assert.deepEqual(saved.diasVisita, ['miercoles']);
});
test('migration refuses invalid legacy data before normalizing any rows', async () => {
    const nombre = ' ' + uniqueName() + ' '; const good = await rawBarrio(nombre);
    const invalid = await rawBarrio(uniqueName(), { lunes: true });
    try {
        await assert.rejects(migration.up(db.getQueryInterface()), /invalidos/);
        assert.equal((await Barrio.findByPk(good)).nombre, nombre);
    } finally { await Barrio.destroy({ where: { id: [good, invalid] } }); }
});
test('migration rolls back name normalization on duplicate collisions', async () => {
    const collision = await rawBarrio(' ' + barrio.nombre);
    try {
        await assert.rejects(migration.up(db.getQueryInterface()), { name: 'SequelizeUniqueConstraintError' });
        assert.equal((await Barrio.findByPk(collision)).nombre, ' ' + barrio.nombre);
    } finally { await Barrio.destroy({ where: { id: collision } }); }
});
