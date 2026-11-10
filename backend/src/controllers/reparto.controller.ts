import { Response } from "express";
import { UniqueConstraintError } from "sequelize";
import { AuthRequest } from "../middlewares/auth.middleware";
import Reparto from "../models/Reparto";
import { resumir, resumirCobrosPorMetodo } from "../services/resumen.service";
import { fechaComercial, rangoDiaComercial } from "../utils/fecha-comercial";
import { ConflictoStock } from "../utils/stock.validation";
import { responderErrorStock } from "../utils/stock.error";

function buscarRepartoDeHoy(usuarioId: string) {
  return Reparto.findOne({ where: { usuarioId, fecha: fechaComercial() } });
}

// Resumen del reparto: entregas y cobros del repartidor en el día (hasta que terminó).
export async function resumenDelReparto(reparto: Reparto) {
  const { inicio, fin } = rangoDiaComercial(reparto.fecha);
  const filtro = { desde: inicio, hasta: reparto.finalizadoEn ?? fin, usuarioId: reparto.usuarioId };
  const [entregas, cobradoPorMetodo] = await Promise.all([resumir(filtro), resumirCobrosPorMetodo(filtro)]);

  return {
    fecha: reparto.fecha,
    iniciadoEn: reparto.iniciadoEn,
    finalizadoEn: reparto.finalizadoEn,
    entregas: entregas.cantidadEntregas,
    totalVendido: entregas.totalImporte,
    cobrado: entregas.totalPagado,
    cobradoPorMetodo,
    fiado: entregas.totalPendiente,
    productos: entregas.productos,
  };
}

export async function repartoDeHoy(req: AuthRequest, res: Response) {
  try {
    const reparto = await buscarRepartoDeHoy(req.usuario!.id);
    return res.json({
      reparto,
      resumen: reparto?.finalizadoEn ? await resumenDelReparto(reparto) : null,
    });
  } catch (error) {
    return responderErrorStock(res, error, "Error al obtener el reparto de hoy");
  }
}

// Empieza el reparto de hoy. Repetirlo no duplica nada.
export async function comenzarReparto(req: AuthRequest, res: Response) {
  try {
    const usuarioId = req.usuario!.id;
    let reparto = await buscarRepartoDeHoy(usuarioId);
    if (reparto?.finalizadoEn) throw new ConflictoStock("El reparto de hoy ya terminó");
    if (!reparto) {
      try {
        await Reparto.create({ usuarioId, fecha: fechaComercial() });
      } catch (error) {
        // Dos pedidos a la vez (doble toque): el otro ya lo creó.
        if (!(error instanceof UniqueConstraintError)) throw error;
      }
    }
    reparto = await buscarRepartoDeHoy(usuarioId);
    return res.status(201).json(reparto);
  } catch (error) {
    return responderErrorStock(res, error, "Error al comenzar el reparto");
  }
}

export async function terminarReparto(req: AuthRequest, res: Response) {
  try {
    const reparto = await buscarRepartoDeHoy(req.usuario!.id);
    if (!reparto) return res.status(404).json({ error: "Todavía no comenzaste el reparto de hoy" });
    if (reparto.finalizadoEn) throw new ConflictoStock("El reparto de hoy ya terminó");
    await reparto.update({ finalizadoEn: new Date() });
    return res.json({ reparto, resumen: await resumenDelReparto(reparto) });
  } catch (error) {
    return responderErrorStock(res, error, "Error al terminar el reparto");
  }
}

// "Cancelar fin de reparto": el reparto de hoy vuelve a quedar en curso (solo el del día).
export async function reabrirReparto(req: AuthRequest, res: Response) {
  try {
    const reparto = await buscarRepartoDeHoy(req.usuario!.id);
    if (!reparto) return res.status(404).json({ error: "Todavía no comenzaste el reparto de hoy" });
    if (!reparto.finalizadoEn) throw new ConflictoStock("El reparto de hoy sigue en curso");
    await reparto.update({ finalizadoEn: null });
    return res.json(reparto);
  } catch (error) {
    return responderErrorStock(res, error, "Error al reabrir el reparto");
  }
}
