'use strict';
// Elimina todas las tablas de la base configurada en .env (incluida SequelizeMeta).
// Uso: npm run db:reset -- --confirmar
// Despues correr: npm run db:migrate && npm run db:admin
require('dotenv').config();

if (!process.argv.includes('--confirmar')) {
    console.error('Este comando borra TODAS las tablas de ' + process.env.DB_NAME + ' en ' + process.env.DB_HOST);
    console.error('Para ejecutarlo: npm run db:reset -- --confirmar');
    process.exit(1);
}

const sequelize = require('../dist/config/database').default;

(async () => {
    const qi = sequelize.getQueryInterface();
    const tablas = await qi.showAllTables();
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
        for (const tabla of tablas) await qi.dropTable(tabla);
    } finally {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    }
    const restantes = await qi.showAllTables();
    console.log('Tablas eliminadas: ' + tablas.length + ' | restantes: ' + restantes.length);
    await sequelize.close();
})().catch((error) => {
    console.error('Error al vaciar la base:', error.message);
    process.exit(1);
});
