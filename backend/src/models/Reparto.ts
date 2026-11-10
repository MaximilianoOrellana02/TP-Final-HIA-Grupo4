import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { uuidDeModelo } from "../utils/cliente.validation";

interface RepartoAttributes {
  id: string;
  usuarioId: string;
  fecha: string; // día comercial AAAA-MM-DD
  iniciadoEn: Date;
  finalizadoEn: Date | null;
}

interface RepartoCreationAttributes extends Optional<
  RepartoAttributes,
  "id" | "iniciadoEn" | "finalizadoEn"
> {}

class Reparto
  extends Model<RepartoAttributes, RepartoCreationAttributes>
  implements RepartoAttributes
{
  public id!: string;
  public usuarioId!: string;
  public fecha!: string;
  public iniciadoEn!: Date;
  public finalizadoEn!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Reparto.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: { uuidValido: uuidDeModelo },
    },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    iniciadoEn: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    finalizadoEn: { type: DataTypes.DATE(3), allowNull: true, defaultValue: null },
  },
  {
    sequelize,
    tableName: "repartos",
    timestamps: true,
    indexes: [
      { name: "uq_reparto_usuario_fecha", unique: true, fields: ["usuarioId", "fecha"] },
    ],
  },
);

export default Reparto;
