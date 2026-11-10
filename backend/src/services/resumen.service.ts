import { col, fn, Op, WhereOptions } from "sequelize";
import Historial from "../models/Historial";
import HistorialDetalle from "../models/HistorialDetalle";
import Producto from "../models/Producto";
import { RangoFechas, redondear } from "../utils/historial.validation";

// Filtro de las entregas a resumir: un rango de fechas y, opcionalmente, un solo repartidor.
export interface FiltroResumen extends RangoFechas {
  usuarioId?: string;
}

export function whereFecha(rango: RangoFechas): WhereOptions {
  if (!rango.desde && !rango.hasta) return {};
  return {
    fecha: {
      ...(rango.desde ? { [Op.gte]: rango.desde } : {}),
      ...(rango.hasta ? { [Op.lte]: rango.hasta } : {}),
    },
  };
}

function whereResumen(filtro: FiltroResumen): WhereOptions {
  return { ...whereFecha(filtro), ...(filtro.usuarioId ? { usuarioId: filtro.usuarioId } : {}) };
}

interface Totales {
  cantidadEntregas: number;
  totalImporte: number;
  totalPagado: number;
}

export async function resumir(filtro: FiltroResumen) {
  const where = whereResumen(filtro);
  const totales = (await Historial.findOne({
    where,
    attributes: [
      [fn("COUNT", col("id")), "cantidadEntregas"],
      [fn("SUM", col("importeTotal")), "totalImporte"],
      [fn("SUM", col("montoPagado")), "totalPagado"],
    ],
    raw: true,
  })) as unknown as Totales | null;
  const cantidades = (await HistorialDetalle.findAll({
    include: [
      { model: Historial, as: "historial", attributes: [], where },
      { model: Producto, as: "producto", attributes: ["nombre"] },
    ],
    attributes: [
      [fn("SUM", col("cantidadEntregada")), "entregados"],
      [fn("SUM", col("cantidadEnvaseDevuelto")), "devueltos"],
    ],
    group: ["producto.id", "producto.nombre"],
    order: [[col("producto.nombre"), "ASC"]],
    raw: true,
  })) as unknown as Array<{
    "producto.nombre": string;
    entregados: string;
    devueltos: string;
  }>;
  const totalImporte = redondear(Number(totales?.totalImporte ?? 0));
  const totalPagado = redondear(Number(totales?.totalPagado ?? 0));
  return {
    cantidadEntregas: Number(totales?.cantidadEntregas ?? 0),
    totalImporte,
    totalPagado,
    totalPendiente: redondear(totalImporte - totalPagado),
    productos: cantidades.map((c) => ({
      nombre: c["producto.nombre"],
      cantidad: Number(c.entregados),
      devueltos: Number(c.devueltos),
    })),
  };
}

export async function resumirCobrosPorMetodo(filtro: FiltroResumen) {
  const filas = (await Historial.findAll({
    where: whereResumen(filtro),
    attributes: [
      "metodoPago",
      [fn("SUM", col("montoPagado")), "total"],
    ],
    group: ["metodoPago"],
    raw: true,
  })) as unknown as Array<{
    metodoPago: "efectivo" | "transferencia" | "mercadopago";
    total: string;
  }>;

  const cobrado = { efectivo: 0, transferencia: 0, mercadopago: 0 };
  for (const fila of filas) cobrado[fila.metodoPago] = redondear(Number(fila.total));
  return cobrado;
}
