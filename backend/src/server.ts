import dotenv from 'dotenv';
dotenv.config();
import './models/associations'

import app from './app';
import sequelize from './config/database';

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos exitosa');

        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error al conectar con la base de datos:', error);
    }
}

iniciarServidor();