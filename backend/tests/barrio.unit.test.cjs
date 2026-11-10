const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const db = new Sequelize('unit', 'unit', 'unit', { dialect: 'mysql', logging: false });
const databasePath = require.resolve('../dist/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: db } };
const Barrio = require('../dist/models/Barrio').default;
const { validarBarrio, diasBarrio, DIAS_VISITA } = require('../dist/utils/barrio.validation');
after(() => db.close());

test('requires object bodies and meaningful bounded string names', () => {
    for (const body of [undefined, null, [], 'text', {}, { nombre: 123 }, { nombre: null }, { nombre: ' ' }, { nombre: '' }, { nombre: 'x'.repeat(101) }]) {
        assert.throws(() => validarBarrio(body, true));
    }
    assert.deepEqual(validarBarrio({ nombre: ' Centro ' }, true), { nombre: 'Centro' });
    assert.deepEqual(validarBarrio({ nombre: 'x'.repeat(100) }, true), { nombre: 'x'.repeat(100) });
});

test('uses the frontend day catalog and rejects malformed, unknown or duplicate days', () => {
    assert.deepEqual(DIAS_VISITA, ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']);
    for (const dias of [undefined, null, 'lunes', {}, [123, null], ['invalid'], ['lunes', 'lunes'], ['Lunes'], ['mi\u00e9rcoles'], [' lunes '], Array(8).fill('lunes')]) assert.throws(() => diasBarrio(dias));
    assert.deepEqual(diasBarrio([]), []);
    assert.deepEqual(diasBarrio([...DIAS_VISITA]), [...DIAS_VISITA]);
});

test('partial updates preserve omissions, allow clearing days and reject empty updates', () => {
    assert.deepEqual(validarBarrio({ diasVisita: [] }, false), { diasVisita: [] });
    assert.deepEqual(validarBarrio({ nombre: ' Centro ' }, false), { nombre: 'Centro' });
    for (const body of [{}, { id: 'protected' }, { nombre: null }, { diasVisita: null }]) assert.throws(() => validarBarrio(body, false));
});

test('model applies name and day validation independently of HTTP', async () => {
    for (const data of [{ nombre: 123 }, { nombre: ' ' }, { nombre: 'x'.repeat(101) }, { diasVisita: 'lunes' }, { diasVisita: {} }, { diasVisita: ['lunes', 'lunes'] }, { diasVisita: null }]) {
        // build() nunca lanza: la regla vive en validate() y llega como SequelizeValidationError.
        const instance = Barrio.build({ nombre: 'Valid', ...data });
        await assert.rejects(instance.validate(), { name: 'SequelizeValidationError' });
    }
    const barrio = Barrio.build({ nombre: ' Centro ' });
    await barrio.validate(); assert.equal(barrio.nombre, 'Centro'); assert.deepEqual(barrio.diasVisita, []);
});

test('visit days are stored in week order regardless of input order', () => {
    assert.deepEqual(diasBarrio(['domingo', 'lunes', 'miercoles']), ['lunes', 'miercoles', 'domingo']);
    assert.deepEqual(validarBarrio({ diasVisita: ['sabado', 'martes'] }, false), { diasVisita: ['martes', 'sabado'] });
});
