import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { uuidDeModelo } from '../utils/cliente.validation';
import { CANTIDAD_MAXIMA } from '../utils/stock.validation';
import { IMPORTE_MAXIMO } from '../utils/historial.validation';

interface HistorialDetalleAttributes {
    id: string;
    historialId: string;
    productoId: string;
    cantidadEntregada: number;
    cantidadEnvaseDevuelto: number;
    precioUnitario: number;
    importe: number;
}

interface HistorialDetalleCreationAttributes
    extends Optional<HistorialDetalleAttributes, 'id' | 'cantidadEnvaseDevuelto'> { }

// MySQL devuelve DECIMAL como texto; la API siempre expone los importes como numero.
function decimal(campo: keyof HistorialDetalleAttributes) {
    return {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        get(this: HistorialDetalle) { const value = this.getDataValue(campo); return value == null ? value : Number(value); },
        validate: { min: 0, max: IMPORTE_MAXIMO },
    };
}

class HistorialDetalle extends Model<HistorialDetalleAttributes, HistorialDetalleCreationAttributes>
    implements HistorialDetalleAttributes {
    public id!: string;
    public historialId!: string;
    public productoId!: string;
    public cantidadEntregada!: number;
    public cantidadEnvaseDevuelto!: number;
    public precioUnitario!: number;
    public importe!: number;
}

HistorialDetalle.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        historialId: { type: DataTypes.UUID, allowNull: false, validate: { uuidValido: uuidDeModelo } },
        productoId: { type: DataTypes.UUID, allowNull: false, validate: { uuidValido: uuidDeModelo } },
        cantidadEntregada: { type: DataTypes.INTEGER, allowNull: false, validate: { isInt: true, min: 0, max: CANTIDAD_MAXIMA } },
        cantidadEnvaseDevuelto: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { isInt: true, min: 0, max: CANTIDAD_MAXIMA } },
        precioUnitario: decimal('precioUnitario'),
        importe: decimal('importe'),
    },
    {
        sequelize,
        tableName: 'historial_detalles',
        timestamps: false, // no necesitamos createdAt/updatedAt en el detalle, ya lo tiene la cabecera
    }
);

export default HistorialDetalle;
