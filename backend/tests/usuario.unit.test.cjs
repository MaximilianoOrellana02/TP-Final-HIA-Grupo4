const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { Sequelize } = require('sequelize');

process.env.JWT_SECRET = 'usuario-unit-tests-only';
const db = new Sequelize('unit', 'unit', 'unit', { dialect: 'mysql', logging: false });
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const Usuario = require('../dist/models/Usuario').default;
const validation = require('../dist/utils/usuario.validation');
const tokens = require('../dist/services/token.service');
after(() => db.close());

const session = { id: '11111111-1111-4111-8111-111111111111', username: 'test', sessionVersion: 0 };
const data = { username: 'test', nombreCompleto: 'Test', email: 'test@example.com', passwordHash: 'test-hash' };

test('access token round trip and opaque recovery token separation', () => {
    assert.deepEqual(tokens.verificarSesion(tokens.crearSesion(session)), session);
    const reset = tokens.crearRecuperacion();
    assert.match(reset.token, /^[a-f0-9]{64}$/);
    assert.equal(reset.hash, tokens.hashRecuperacion(reset.token));
    assert.notEqual(reset.hash, reset.token);
    assert.equal(tokens.verificarSesion(reset.token), null);
    assert.ok(reset.expiresAt > new Date());
});

for (const [name, payload, options] of [
    ['reset purpose', { proposito: 'reset_password' }, {}],
    ['missing purpose', { proposito: undefined }, {}],
    ['missing session version', { sessionVersion: undefined }, {}],
    ['negative session version', { sessionVersion: -1 }, {}],
    ['string session version', { sessionVersion: '0' }, {}],
    ['invalid id', { id: 'not-a-uuid' }, {}],
    ['missing username', { username: undefined }, {}],
    ['wrong audience', {}, { audience: 'different-api' }],
    ['wrong issuer', {}, { issuer: 'different-issuer' }],
    ['wrong algorithm', {}, { algorithm: 'HS384' }],
    ['expired', {}, { expiresIn: -1 }],
]) {
    test(`rejects token: ${name}`, () => {
        const token = jwt.sign({ ...session, proposito: 'access', ...payload }, process.env.JWT_SECRET, {
            issuer: 'soderia-backend', audience: 'soderia-api', algorithm: 'HS256', expiresIn: '1h', ...options,
        });
        assert.equal(tokens.verificarSesion(token), null);
    });
}

test('rejects tokens without expiration, forged signatures and legacy sessions', () => {
    const opts = { issuer: 'soderia-backend', audience: 'soderia-api' };
    assert.equal(tokens.verificarSesion(jwt.sign({ ...session, proposito: 'access' }, process.env.JWT_SECRET, opts)), null);
    assert.equal(tokens.verificarSesion(jwt.sign({ ...session, proposito: 'access' }, 'wrong-secret', { ...opts, expiresIn: '1h' })), null);
    assert.equal(tokens.verificarSesion(jwt.sign({ id: session.id, username: session.username }, process.env.JWT_SECRET)), null);
});

test('missing signing configuration is a server error, not bad credentials', () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try { assert.throws(() => tokens.verificarSesion('anything'), /JWT_SECRET/); }
    finally { process.env.JWT_SECRET = saved; }
});

test('validates passwords consistently including bcrypt byte limit', () => {
    for (const value of [null, undefined, 123456, {}, [], '', '12345', '      ', 'a'.repeat(73), '\u00e9'.repeat(37)]) {
        assert.equal(validation.passwordValida(value), false);
    }
    for (const value of ['admin123', '123456', 'a'.repeat(72), '\u00e9'.repeat(36)]) {
        assert.equal(validation.passwordValida(value), true);
    }
    assert.equal(validation.passwordLoginValida('x'), true, 'legacy short passwords can still log in');
});

test('rejects malformed bodies and normalizes account fields', () => {
    for (const body of [null, undefined, [], 'text', 123]) assert.deepEqual(validation.cuerpo({ body }), {});
    assert.equal(validation.texto('  Test  ', 50), 'Test');
    assert.equal(validation.texto('   ', 50), null);
    assert.equal(validation.texto('a'.repeat(51), 50), null);
    assert.equal(validation.emailValido(' TEST@Example.COM '), 'test@example.com');
    for (const email of ['invalid', {}, 123, 'a'.repeat(151) + '@example.com']) assert.equal(validation.emailValido(email), null);
});

test('model normalizes fields and enforces email and name validation', async () => {
    const user = Usuario.build({ ...data, username: ' test ', nombreCompleto: ' Test ', email: ' TEST@Example.COM ' });
    await user.validate();
    assert.equal(user.username, 'test');
    assert.equal(user.nombreCompleto, 'Test');
    assert.equal(user.email, 'test@example.com');
    for (const invalid of [{ username: '  ' }, { username: 'x'.repeat(51) }, { nombreCompleto: ' ' }, { nombreCompleto: 'x'.repeat(101) }, { email: null }, { email: 'invalid' }]) {
        await assert.rejects(Usuario.build({ ...data, ...invalid }).validate());
    }
});

test('migration refuses missing or duplicate emails before changing schema', async () => {
    const migration = require('../migrations/20260908000000-harden-usuarios-auth');
    for (const counts of [[1, 0], [0, 1]]) {
        let queries = 0;
        const qi = { sequelize: { query: async () => [[{ total: counts[queries++] }]] }, describeTable: () => assert.fail('schema must not change') };
        await assert.rejects(migration.up(qi, Sequelize), /emails vacios o duplicados/);
    }
});
