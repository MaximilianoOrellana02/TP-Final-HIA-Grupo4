import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { DiaVisita, diasBarrio, nombreBarrio } from '../utils/barrio.validation';

interface BarrioAttributes {
  id: string;
  nombre: string;
  diasVisita: DiaVisita[];
}

interface BarrioCreationAttributes extends Optional<
  BarrioAttributes,
  "id" | "diasVisita"
> {}

class Barrio
  extends Model<BarrioAttributes, BarrioCreationAttributes>
  implements BarrioAttributes
{
  public id!: string;
  public nombre!: string;
  public diasVisita!: DiaVisita[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Barrio.init(
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
      // El setter solo normaliza; las reglas viven en validate() para que build() nunca lance.
      set(value: unknown) { this.setDataValue('nombre', (typeof value === 'string' ? value.trim() : value) as string); },
      validate: { nombreValido(value: unknown) { nombreBarrio(value); } },
    },
    diasVisita: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      validate: { diasValidos(value: unknown) { diasBarrio(value); } },
    },
  },
  {
    sequelize,
    tableName: "barrios",
    timestamps: true,
  },
);

export default Barrio;
