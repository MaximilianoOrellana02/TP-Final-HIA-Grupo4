import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

import { ROLES_USUARIO, RolUsuario } from "../utils/usuario.validation";

export type { RolUsuario };

interface UsuarioAttributes {
    id: string;
    username: string;
    passwordHash: string;
    nombreCompleto: string;
    email: string;
    sessionVersion: number;
    resetTokenHash: string | null;
    resetTokenExpiresAt: Date | null;
    rol: RolUsuario;
}

interface UsuarioCreationAttributes extends Optional<UsuarioAttributes,
    'id' | 'sessionVersion' | 'resetTokenHash' | 'resetTokenExpiresAt' | 'rol'> { }

class Usuario extends Model<UsuarioAttributes, UsuarioCreationAttributes>
    implements UsuarioAttributes {
    public id!: string;
    public username!: string;
    public passwordHash!: string;
    public nombreCompleto!: string;
    public email!: string;
    public sessionVersion!: number;
    public resetTokenHash!: string | null;
    public resetTokenExpiresAt!: Date | null;
    public rol!: RolUsuario;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Usuario.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        username: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            set(value: string) { this.setDataValue('username', typeof value === 'string' ? value.trim() : value); },
            validate: { notEmpty: true, len: [1, 50] },
        },
        passwordHash: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        nombreCompleto: {
            type: DataTypes.STRING(100),
            allowNull: false,
            set(value: string) { this.setDataValue('nombreCompleto', typeof value === 'string' ? value.trim() : value); },
            validate: { notEmpty: true, len: [1, 100] },
        },
        email: {
            type: DataTypes.STRING(150),
            allowNull: false,
            unique: true,
            set(value: string) { this.setDataValue('email', typeof value === 'string' ? value.trim().toLowerCase() : value); },
            validate: { isEmail: true, len: [1, 150] },
        },
        sessionVersion: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        resetTokenHash: { type: DataTypes.STRING(64), allowNull: true, defaultValue: null, unique: true },
        resetTokenExpiresAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
        rol: {
            type: DataTypes.ENUM(...ROLES_USUARIO),
            allowNull: false,
            defaultValue: 'repartidor',
            validate: { isIn: [[...ROLES_USUARIO]] },
        },
    },
    {
        sequelize,
        tableName: 'usuarios',
        timestamps: true, // agrega createdAt y updatedAt automáticamente
    }
);

export default Usuario;