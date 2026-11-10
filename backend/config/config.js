require('dotenv').config();
const fs = require('fs');
const path = require('path');

const usarSSL = process.env.DB_SSL === 'true';
const rutaCertificado = path.join(process.cwd(), 'src', 'config', 'aiven-ca.pem');

module.exports = {
    development: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        dialectOptions: usarSSL
            ? { ssl: { ca: fs.readFileSync(rutaCertificado).toString(), rejectUnauthorized: false } }
            : {},
    },
};