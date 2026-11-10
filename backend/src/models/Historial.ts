import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { uuidDeModelo } from "../utils/cliente.validation";
import {
  AjusteSaldoInput,
  IMPORTE_MAXIMO,
  METODOS_PAGO,
  MetodoPago as Metodo,
  OBSERVACION_MAXIMA,
} from "../utils/historial.validation";

export type MetodoPago = Metodo;

interface HistorialAttributes {
  id: string;
  clienteId: string;
  usuarioId: string;
  fecha: Date;
  saldoAnterior: number;
  importeTotal: number;
  montoPagado: number;
  saldoFinal: number;
  observacion: string | null;
  metodoPago: MetodoPago;
  ajusteSaldo: AjusteSaldoInput | null;
}

interface HistorialCreationAttributes extends Optional<
  HistorialAttributes,
  "id" | "fecha" | "observacion" | "metodoPago" | "ajusteSaldo"
> {}

// MySQL devuelve DECIMAL como texto; la API siempre expone los importes como numero.
function decimal(campo: keyof HistorialAttributes, extra: object = {}) {
  return {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    get(this: Historial) {
      const value = this.getDataValue(campo);
      return value == null ? value : Number(value);
    },
    ...extra,
  };
}

class Historial
  extends Model<HistorialAttributes, HistorialCreationAttributes>
  implements HistorialAttributes
{
  public id!: string;
  public clienteId!: string;
  public usuarioId!: string;
  public fecha!: Date;
  public saldoAnterior!: number;
  public importeTotal!: number;
  public montoPagado!: number;
  public saldoFinal!: number;
  public observacion!: string | null;
  public metodoPago!: MetodoPago;
  public ajusteSaldo!: AjusteSaldoInput | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Historial.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    clienteId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: { uuidValido: uuidDeModelo },
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: { uuidValido: uuidDeModelo },
    },
    fecha: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    // Los saldos pueden ser negativos (credito a favor del cliente); importes y pagos no.
    saldoAnterior: decimal("saldoAnterior"),
    importeTotal: decimal("importeTotal", {
      validate: { min: 0, max: IMPORTE_MAXIMO },
    }),
    montoPagado: decimal("montoPagado", {
      defaultValue: 0,
      validate: { min: 0, max: IMPORTE_MAXIMO },
    }),
    saldoFinal: decimal("saldoFinal"),
    observacion: {
      type: DataTypes.STRING(OBSERVACION_MAXIMA),
      allowNull: true,
      set(value: unknown) {
        const texto = typeof value === "string" ? value.trim() : value;
        this.setDataValue(
          "observacion",
          (texto === "" ? null : texto) as string | null,
        );
      },
      validate: { len: [1, OBSERVACION_MAXIMA] },
    },
    ajusteSaldo: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    metodoPago: {
      type: DataTypes.ENUM(...METODOS_PAGO),
      allowNull: false,
      defaultValue: "efectivo",
      validate: { isIn: [[...METODOS_PAGO]] },
    },
  },
  {
    sequelize,
    tableName: "historiales",
    timestamps: true,
  },
);

export default Historial;
