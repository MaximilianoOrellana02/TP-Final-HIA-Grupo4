import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SaldoEnvaseAttributes {
    id: string;
    clienteId: string;
    productoId: string;
    cantidad: number;
}

interface SaldoEnvaseCreationAttributes
    extends Optional<SaldoEnvaseAttributes, 'id' | 'cantidad'> { }

class SaldoEnvase extends Model<SaldoEnvaseAttributes, SaldoEnvaseCreationAttributes>
    implements SaldoEnvaseAttributes {
    public id!: string;
    public clienteId!: string;
    public productoId!: string;
    public cantidad!: number;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

SaldoEnvase.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        clienteId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        productoId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        cantidad: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
    },
    {
        sequelize,
        tableName: 'saldos_envase',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['clienteId', 'productoId'], // un solo registro de saldo por combinación cliente+producto
            },
        ],
    }
);

export default SaldoEnvase;