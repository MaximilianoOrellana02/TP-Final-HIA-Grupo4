'use strict';
// Crea el usuario administrador inicial (el registro por API exige token).
// Uso: npm run db:admin -- --username admin --email admin@dominio.com [--password clave]
// Si no se pasa --password se genera una clave segura y se muestra por consola.
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcrypt');

function argumento(nombre) {
    const indice = process.argv.indexOf('--' + nombre);
    return indice !== -1 ? process.argv[indice + 1] : undefined;
}

function generarPassword(longitud = 20) {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%*+-_';
    const bytes = crypto.randomBytes(longitud);
    return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

const username = argumento('username') || 'admin';
const email = argumento('email');
const nombreCompleto = argumento('nombre') || 'Administrador';
const password = argumento('password') || generarPassword();

if (!email) {
    console.error('Falta --email');
    process.exit(1);
}

const sequelize = require('../dist/config/database').default;
const Usuario = require('../dist/models/Usuario').default;

(async () => {
    const existente = await Usuario.findOne({ where: { username } });
    if (existente) {
        console.error('Ya existe un usuario con username ' + username);
        process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await Usuario.create({ username, nombreCompleto, email, passwordHash, rol: 'admin' });
    console.log('Usuario creado');
    console.log('  username: ' + username);
    console.log('  email:    ' + email);
    console.log('  password: ' + password);
    await sequelize.close();
})().catch((error) => {
    console.error('Error al crear el admin:', error.message);
    process.exit(1);
});
