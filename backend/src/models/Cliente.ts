import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import { coordenadasValidas, esUuid } from '../utils/cliente.validation';

export type TipoCliente = "particular" | "confianza";
export type CategoriaCliente = "domicilio" | "restaurante";

interface ClienteAttributes {
  id: string;
  nombre: string;
  apellido: string;
  direccion: string | null;
  telefono: string | null;
  localidad: string | null;
  barrioId: string | null;
  categoria: CategoriaCliente;
  saldoActual: number;
  tipoCliente: TipoCliente;
  latitud: number | null;
  longitud: number | null;
  ultimaVisitaFecha: string | null;
  // Indicaciones para el repartidor: nota libre y referencia corta del lugar.
  notaRepartidor: string | null;
  referencia: string | null;
}


export interface ClienteCreationAttributes extends Optional<
  ClienteAttributes,
  "id" | "saldoActual" | "barrioId" | "categoria" | "latitud" | "longitud" | 'ultimaVisitaFecha' | 'direccion' | 'telefono' | 'localidad' | 'tipoCliente' | 'notaRepartidor' | 'referencia'
> { }

class Cliente
  extends Model<ClienteAttributes, ClienteCreationAttributes>
  implements ClienteAttributes {
  public id!: string;
  public nombre!: string;
  public apellido!: string;
  public direccion!: string | null;
  public telefono!: string | null;
  public localidad!: string | null;
  public notaRepartidor!: string | null;
  public referencia!: string | null;
  public barrioId!: string | null;
  public categoria!: CategoriaCliente;
  public saldoActual!: number;
  public tipoCliente!: TipoCliente;
  public latitud!: number | null;
  public longitud!: number | null;
  public ultimaVisitaFecha!: string | null;


  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;
}

Cliente.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      set(value: string) { this.setDataValue('nombre', typeof value === 'string' ? value.trim() : value); },
      validate: { notEmpty: true, len: [1, 100] },
    },
    apellido: {
      type: DataTypes.STRING(100),
      allowNull: false,
      set(value: string) { this.setDataValue('apellido', typeof value === 'string' ? value.trim() : value); },
      validate: { notEmpty: true, len: [1, 100] },
    },
    direccion: {
      type: DataTypes.STRING(200),
      allowNull: true, // puede que no siempre se cargue al momento de registrar
      defaultValue: null,
      validate: { len: [0, 200] },
    },
    telefono: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: null,
      validate: { len: [0, 30] },
    },
    localidad: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
      validate: { len: [0, 100] },
    },
    notaRepartidor: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      validate: { len: [0, 255] },
    },
    referencia: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
      validate: { len: [0, 100] },
    },
    saldoActual: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      get() { return Number(this.getDataValue('saldoActual')); },
    },
    tipoCliente: {
      type: DataTypes.ENUM("particular", "confianza"),
      allowNull: false,
      defaultValue: "particular",
      validate: { isIn: [['particular', 'confianza']] },
    },
    barrioId: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      validate: { uuid(value: unknown) { if (value !== null && !esUuid(value)) throw new Error('barrioId invalido'); } },
    },
    categoria: {
      type: DataTypes.ENUM("domicilio", "restaurante"),
      allowNull: false,
      defaultValue: "domicilio",
      validate: { isIn: [['domicilio', 'restaurante']] },
    },
    latitud: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      defaultValue: null,
      get() { const value = this.getDataValue('latitud'); return value == null ? null : Number(value); },
      validate: { min: -90, max: 90 },
    },
    longitud: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      defaultValue: null,
      get() { const value = this.getDataValue('longitud'); return value == null ? null : Number(value); },
      validate: { min: -180, max: 180 },
    },
    ultimaVisitaFecha: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "clientes",
    timestamps: true,
    paranoid: true,
    validate: {
      parCoordenadas(this: Cliente) {
        if (this.latitud == null && this.longitud == null) return;
        if (!coordenadasValidas(this.latitud, this.longitud)) throw new Error('Coordenadas incompletas o invalidas');
      },
    },
  },
);

export default Cliente;
