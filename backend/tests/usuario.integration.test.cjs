const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Sequelize, ConnectionError } = require('sequelize');
const config = require('../config/config').development;

const databaseName = 'soderia_test_' + randomBytes(8).toString('hex');
const adminDb = new Sequelize({ ...config, logging: false });
const db = new Sequelize({ ...config, database: databaseName, logging: false });
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
let mails = [], mailFails = false;
const emailPath = require.resolve('../dist/services/email.service');
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: {
    enviarEmailRecuperacion: async (email, name, link) => {
        if (mailFails) throw new Error('simulated SMTP failure');
        mails.push({ email, name, link });
    },
} };
process.env.JWT_SECRET = 'usuario-integration-tests-only';
process.env.FRONTEND_URL_RESET = 'http://example.invalid';
const Usuario = require('../dist/models/Usuario').default;
const { crearUsuarioRouter } = require('../dist/routes/usuario.routes');
const { crearSesion, hashRecuperacion } = require('../dist/services/token.service');
let created = false, server, base, user, access, fixtureHash;
const registration = { username: 'new-user', nombreCompleto: 'New User', email: 'new@example.com', password: 'initial123' };

function assertScratchDatabase() {
    assert.match(databaseName, /^soderia_test_[a-f0-9]{16}$/);
    assert.equal(db.getDatabaseName(), databaseName);
    assert.notEqual(databaseName, config.database);
}

async function request(path, body, token, method = 'POST') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), retryAfter: response.headers.get('retry-after') };
}

async function recovery() {
    assert.equal((await request('/recuperar', { email: user.email })).status, 200);
    return new URL(mails.at(-1).link).searchParams.get('token');
}

before(async () => {
    assertScratchDatabase();
    await adminDb.getQueryInterface().createDatabase(databaseName);
    created = true;
    const qi = db.getQueryInterface();
    await require('../migrations/20261110100000-esquema-inicial').up(qi, Sequelize);
    fixtureHash = await bcrypt.hash('initial123', 10);
});

beforeEach(async () => {
    assertScratchDatabase();
    await Usuario.destroy({ where: {}, truncate: true, cascade: true });
    mails = []; mailFails = false;
    user = await Usuario.create({ username: 'fixture', nombreCompleto: 'Fixture', email: 'fixture@example.com', passwordHash: fixtureHash, rol: 'admin' });
    access = crearSesion(user);
    const app = express();
    app.use(express.json());
    app.use('/api/usuarios', crearUsuarioRouter());
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = 'http://127.0.0.1:' + server.address().port + '/api/usuarios';
});

afterEach(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server = undefined;
});

after(async () => {
    await db.close();
    try {
        if (created) { assertScratchDatabase(); await adminDb.getQueryInterface().dropDatabase(databaseName); }
    } finally { await adminDb.close(); }
});

test('registration and password change require a valid session', async () => {
    assert.equal((await request('/registro', registration)).status, 401);
    assert.equal((await request('/registro', registration, 'bad-token')).status, 401);
    assert.equal((await request('/password', {}, undefined, 'PUT')).status, 401);
});

test('only admins register users; new users default to repartidor and unknown roles are rejected', async () => {
    const repartidor = await Usuario.create({ username: 'driver', nombreCompleto: 'Driver', email: 'driver@example.com', passwordHash: fixtureHash, rol: 'repartidor' });
    assert.equal((await request('/registro', { ...registration, rol: 'admin' }, crearSesion(repartidor))).status, 403);
    assert.equal((await request('/registro', { ...registration, rol: 'jefe' }, access)).status, 400);
    assert.equal(await Usuario.count({ where: { username: registration.username } }), 0);
    let result = await request('/registro', registration, access);
    assert.equal(result.status, 201); assert.equal(result.body.rol, 'repartidor');
    result = await request('/registro', { ...registration, username: 'other-admin', email: 'other-admin@example.com', rol: 'admin' }, access);
    assert.equal(result.status, 201); assert.equal(result.body.rol, 'admin');
});

test('GET /me returns the current public data including the role', async () => {
    assert.equal((await request('/me', undefined, undefined, 'GET')).status, 401);
    const result = await request('/me', undefined, access, 'GET');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { id: user.id, username: 'fixture', nombreCompleto: 'Fixture', email: 'fixture@example.com', rol: 'admin' });
});

test('registration normalizes fields, hashes password and exposes only public data', async () => {
    const result = await request('/registro', { ...registration, username: ' new-user ', email: ' NEW@Example.COM ', nombreCompleto: ' New User ' }, access);
    assert.equal(result.status, 201);
    assert.deepEqual(Object.keys(result.body).sort(), ['email', 'id', 'nombreCompleto', 'rol', 'username']);
    assert.equal(result.body.email, registration.email);
    const stored = await Usuario.findByPk(result.body.id);
    assert.equal(await bcrypt.compare(registration.password, stored.passwordHash), true);
    const login = await request('/login', { username: registration.username, password: registration.password });
    assert.equal(login.status, 200);
    assert.deepEqual(Object.keys(login.body.usuario).sort(), ['email', 'id', 'nombreCompleto', 'rol', 'username']);
});

test('invalid registration data returns 400 without creating rows', async () => {
    for (const invalid of [{ username: ' ' }, { username: 'x'.repeat(51) }, { nombreCompleto: ' ' }, { nombreCompleto: 'x'.repeat(101) }, { email: 'invalid' }, { password: 'x' }, { password: 123456 }, { password: 'a'.repeat(73) }, { email: {} }]) {
        assert.equal((await request('/registro', { ...registration, ...invalid }, access)).status, 400);
    }
    assert.equal(await Usuario.count(), 1);
});

test('duplicate username or email including case variants returns 409', async () => {
    for (const duplicate of [{ username: user.username }, { username: user.username.toUpperCase() }, { email: user.email.toUpperCase() }]) {
        assert.equal((await request('/registro', { ...registration, ...duplicate }, access)).status, 409);
    }
});

test('concurrent duplicate username registrations create exactly one account', async () => {
    const results = await Promise.all([
        request('/registro', registration, access),
        request('/registro', { ...registration, email: 'other@example.com' }, access),
    ]);
    assert.deepEqual(results.map(x => x.status).sort(), [201, 409]);
    assert.equal(await Usuario.count({ where: { username: registration.username } }), 1);
});

test('concurrent duplicate email registrations create exactly one account', async () => {
    const results = await Promise.all([
        request('/registro', registration, access),
        request('/registro', { ...registration, username: 'other-user' }, access),
    ]);
    assert.deepEqual(results.map(x => x.status).sort(), [201, 409]);
    assert.equal(await Usuario.count({ where: { email: registration.email } }), 1);
});

test('the database enforces email nonnull and uniqueness even without model validation', async () => {
    const fields = { username: 'direct', nombreCompleto: 'Direct', passwordHash: fixtureHash };
    await assert.rejects(Usuario.create({ ...fields, email: null }, { validate: false }));
    await assert.rejects(Usuario.create({ ...fields, email: user.email }, { validate: false }), { name: 'SequelizeUniqueConstraintError' });
});

test('login uses identical 401 response for unknown user and incorrect password', async () => {
    const unknown = await request('/login', { username: 'missing', password: 'incorrect' });
    const wrong = await request('/login', { username: user.username, password: 'incorrect' });
    assert.equal(unknown.status, 401);
    assert.deepEqual(unknown.body, wrong.body);
    assert.equal(wrong.status, 401);
});

test('malformed login bodies and numeric passwords return 400', async () => {
    for (const body of [undefined, {}, [], { username: user.username, password: 123456 }, { username: {}, password: 'valid123' }]) {
        assert.equal((await request('/login', body)).status, 400);
    }
});

test('recovery stores only token hash and uses same public response for missing email', async () => {
    const known = await request('/recuperar', { email: ' FIXTURE@Example.COM ' });
    const unknown = await request('/recuperar', { email: 'missing@example.com' });
    assert.equal(known.status, 200);
    assert.deepEqual(known.body, unknown.body);
    assert.equal(unknown.status, 200);
    assert.equal(mails.length, 1);
    const token = new URL(mails[0].link).searchParams.get('token');
    await user.reload();
    assert.equal(user.resetTokenHash, hashRecuperacion(token));
    assert.notEqual(user.resetTokenHash, token);
    assert.ok(user.resetTokenExpiresAt > new Date());
});

test('opaque recovery tokens and legacy reset JWTs cannot authorize registration', async () => {
    const token = await recovery();
    const legacy = jwt.sign({ id: user.id, proposito: 'reset_password' }, process.env.JWT_SECRET, { expiresIn: '30m' });
    for (const invalid of [token, legacy]) assert.equal((await request('/registro', registration, invalid)).status, 401);
    assert.equal((await request('/restablecer', { token: access, passwordNueva: 'changed123' })).status, 400);
});

test('reset succeeds once, revokes old sessions, and permits login with new password', async () => {
    const token = await recovery();
    assert.equal((await request('/restablecer', { token, passwordNueva: 'changed123' })).status, 200);
    assert.equal((await request('/restablecer', { token, passwordNueva: 'changed456' })).status, 400);
    assert.equal((await request('/registro', registration, access)).status, 401);
    assert.equal((await request('/login', { username: user.username, password: 'initial123' })).status, 401);
    assert.equal((await request('/login', { username: user.username, password: 'changed123' })).status, 200);
    await user.reload();
    assert.equal(user.resetTokenHash, null);
    assert.equal(user.sessionVersion, 1);
});

test('concurrent reset requests consume the link exactly once in the database', async () => {
    const token = await recovery();
    const results = await Promise.all([
        request('/restablecer', { token, passwordNueva: 'changed123' }),
        request('/restablecer', { token, passwordNueva: 'changed456' }),
    ]);
    assert.deepEqual(results.map(x => x.status).sort(), [200, 400]);
    await user.reload();
    assert.equal(user.sessionVersion, 1);
    assert.equal(user.resetTokenHash, null);
});

test('expired and replaced recovery links are rejected', async () => {
    const old = await recovery();
    const current = await recovery();
    assert.equal((await request('/restablecer', { token: old, passwordNueva: 'changed123' })).status, 400);
    await user.update({ resetTokenExpiresAt: new Date(Date.now() - 1000) });
    assert.equal((await request('/restablecer', { token: current, passwordNueva: 'changed123' })).status, 400);
});

test('password change rejects bad inputs, then revokes sessions and recovery links', async () => {
    const token = await recovery();
    assert.equal((await request('/password', { passwordActual: 123456, passwordNueva: 'changed123' }, access, 'PUT')).status, 400);
    assert.equal((await request('/password', { passwordActual: 'initial123', passwordNueva: 'x' }, access, 'PUT')).status, 400);
    assert.equal((await request('/password', { passwordActual: 'incorrect', passwordNueva: 'changed123' }, access, 'PUT')).status, 401);
    assert.equal((await request('/password', { passwordActual: 'initial123', passwordNueva: 'changed123' }, access, 'PUT')).status, 200);
    assert.equal((await request('/registro', registration, access)).status, 401);
    assert.equal((await request('/restablecer', { token, passwordNueva: 'changed456' })).status, 400);
    assert.equal((await request('/login', { username: user.username, password: 'changed123' })).status, 200);
});

test('concurrent password changes cannot reuse the same session version', async () => {
    const results = await Promise.all([
        request('/password', { passwordActual: 'initial123', passwordNueva: 'changed123' }, access, 'PUT'),
        request('/password', { passwordActual: 'initial123', passwordNueva: 'changed456' }, access, 'PUT'),
    ]);
    assert.deepEqual(results.map(x => x.status).sort(), [200, 401]);
    await user.reload();
    assert.equal(user.sessionVersion, 1);
});

test('SMTP failure does not expose account existence and clears the failed link', async t => {
    t.mock.method(console, 'error', () => {});
    mailFails = true;
    const known = await request('/recuperar', { email: user.email });
    const unknown = await request('/recuperar', { email: 'missing@example.com' });
    assert.equal(known.status, 200);
    assert.deepEqual(known.body, unknown.body);
    await user.reload();
    assert.equal(user.resetTokenHash, null);
});

test('database connection failures are 503 and query failures 500, never 401', async t => {
    t.mock.method(console, 'error', () => {});
    const method = t.mock.method(Usuario, 'findByPk', async () => { throw new ConnectionError(new Error('offline')); });
    assert.equal((await request('/registro', registration, access)).status, 503);
    method.mock.mockImplementation(async () => { throw new Error('query failed'); });
    assert.equal((await request('/registro', registration, access)).status, 500);
});

for (const [path, limit, method] of [['/login', 15, 'POST'], ['/recuperar', 5, 'POST'], ['/restablecer', 10, 'POST'], ['/registro', 20, 'POST'], ['/password', 10, 'PUT']]) {
    test(`rate limits ${path} and returns Retry-After`, async () => {
        for (let i = 0; i < limit; i++) assert.notEqual((await request(path, {}, undefined, method)).status, 429);
        const blocked = await request(path, {}, undefined, method);
        assert.equal(blocked.status, 429);
        assert.ok(Number(blocked.retryAfter) > 0);
    });
}
