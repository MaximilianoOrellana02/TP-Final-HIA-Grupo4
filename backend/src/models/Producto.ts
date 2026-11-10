import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { PRECIO_MAXIMO, STOCK_MINIMO_MAXIMO, esPrecioValido, nombreProducto } from '../utils/producto.validation';

interface ProductoAttributes {
    id: string;
    nombre: string;
    esRetornable: boolean;
    activo: boolean;
    stockActual: number;
    stockMinimo: number;
    precioParticular: number;
    precioConfianza: number;
}

interface ProductoCreationAttributes
    extends Optional<ProductoAttributes, 'id' | 'esRetornable' | 'activo' | 'stockActual' | 'stockMinimo'> { }

// Precio actual del producto para un tipo de cliente. La base devuelve DECIMAL como texto; la API lo expone como numero.
function columnaPrecio(campo: 'precioParticular' | 'precioConfianza') {
    return {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        get(this: Producto) { const value = this.getDataValue(campo); return value == null ? value : Number(value); },
        validate: {
            precioValido(value: unknown) {
                if (!esPrecioValido(typeof value === 'string' ? Number(value) : value)) {
                    throw new Error(`El precio debe ser mayor a 0, de hasta 2 decimales y no mayor a ${PRECIO_MAXIMO}`);
                }
            },
        },
    };
}

class Producto extends Model<ProductoAttributes, ProductoCreationAttributes>
    implements ProductoAttributes {
    public id!: string;
    public nombre!: string;
    public esRetornable!: boolean;
    public activo!: boolean;
    public stockActual!: number;
    public stockMinimo!: number;
    public precioParticular!: number;
    public precioConfianza!: number;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Producto.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        nombre: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            // El setter solo recorta; las reglas viven en validate() para que build() nunca lance.
            set(value: unknown) { this.setDataValue('nombre', (typeof value === 'string' ? value.trim() : value) as string); },
            validate: { nombreValido(value: unknown) { nombreProducto(value); } },
        },
        esRetornable: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true, // en tu negocio, casi todo es retornable
        },
        activo: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        stockActual: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: { isInt: true },
        },
        stockMinimo: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: { isInt: true, min: 0, max: STOCK_MINIMO_MAXIMO },
        },
        precioParticular: columnaPrecio('precioParticular'),
        precioConfianza: columnaPrecio('precioConfianza'),
    },
    {
        sequelize,
        tableName: 'productos',
        timestamps: true,
    }
);

export default Producto;
