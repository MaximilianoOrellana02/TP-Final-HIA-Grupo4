import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Conexión a PostgreSQL con las variables DB_* (en Docker las define docker-compose.yml).
const sequelize = new Sequelize(
    process.env.DB_NAME as string,
    process.env.DB_USER as string,
    process.env.DB_PASSWORD as string,
    {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        dialect: 'postgres',
        logging: false,
    }
);

export default sequelize;
