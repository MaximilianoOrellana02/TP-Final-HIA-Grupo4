import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { uuidDeModelo } from '../utils/cliente.validation';
import { CANTIDAD_MAXIMA, TIPOS_MOVIMIENTO, TipoMovimiento } from "../utils/stock.validation";

export type TipoMovimientoStock = TipoMovimiento;

interface MovimientoStockAttributes {
    id: string;
    productoId: string;
    usuarioId: string;
    tipo: TipoMovimientoStock;
    cantidad: number;
    motivo: string | null;
    fecha: Date;
}

interface MovimientoStockCreationAttributes
    extends Optional<MovimientoStockAttributes, 'id' | 'fecha' | 'motivo'> { }

class MovimientoStock extends Model<MovimientoStockAttributes, MovimientoStockCreationAttributes>
    implements MovimientoStockAttributes {
    public id!: string;
    public productoId!: string;
    public usuarioId!: string;
    public tipo!: TipoMovimientoStock;
    public cantidad!: number;
    public motivo!: string | null;
    public fecha!: Date;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

MovimientoStock.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        productoId: { type: DataTypes.UUID, allowNull: false, validate: { uuidValido: uuidDeModelo } },
        usuarioId: { type: DataTypes.UUID, allowNull: false, validate: { uuidValido: uuidDeModelo } },
        tipo: {
            type: DataTypes.ENUM(...TIPOS_MOVIMIENTO),
            allowNull: false,
            validate: { isIn: [[...TIPOS_MOVIMIENTO]] },
        },
        cantidad: {
            type: DataTypes.INTEGER,
            allowNull: false,
            // Protege tambien a los otros modulos que crean movimientos (historial de entregas).
            validate: { isInt: true, min: 1, max: CANTIDAD_MAXIMA },
        },
        motivo: {
            type: DataTypes.STRING(255),
            allowNull: true,
            validate: { len: [1, 255] },
        },
        fecha: {
            type: DataTypes.DATE(3),
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        sequelize,
        tableName: 'movimientos_stock',
        timestamps: true,
    }
);

export default MovimientoStock;
