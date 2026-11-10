import { Response } from "express";
import { Op, WhereOptions } from "sequelize";
import { AuthRequest } from "../middlewares/auth.middleware";
import sequelize from "../config/database";
import Producto from "../models/Producto";
import MovimientoStock from "../models/MovimientoStock";
import Usuario from "../models/Usuario";
import {
  ConflictoStock,
  LIMITE_MOVIMIENTOS,
  validarFiltrosMovimientos,
  validarMovimiento,
} from "../utils/stock.validation";
import { responderErrorStock } from "../utils/stock.error";

export async function crearMovimientoStock(req: AuthRequest, res: Response) {
  try {
    const datos = validarMovimiento(req.body);
    const resultado = await sequelize.transaction(async (transaction) => {
      const producto = await Producto.findByPk(datos.productoId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!producto) return null;
      if (!producto.activo)
        throw new ConflictoStock(
          "El producto esta desactivado y no admite movimientos",
        );
      if (datos.tipo === "salida" && producto.stockActual < datos.cantidad) {
        throw new ConflictoStock(
          `Stock insuficiente: hay ${producto.stockActual} y se intentan retirar ${datos.cantidad}`,
        );
      }
      const movimiento = await MovimientoStock.create(
        { ...datos, usuarioId: req.usuario!.id },
        { transaction },
      );
      await producto.increment("stockActual", {
        by: datos.tipo === "entrada" ? datos.cantidad : -datos.cantidad,
        transaction,
      });
      await producto.reload({ transaction });
      return {
        ...movimiento.get({ plain: true }),
        stockActual: producto.stockActual,
      };
    });
    if (!resultado)
      return res.status(404).json({ error: "Producto no encontrado" });
    return res.status(201).json(resultado);
  } catch (error) {
    return responderErrorStock(res, error, "Error al registrar el movimiento");
  }
}

export async function listarMovimientosStock(req: AuthRequest, res: Response) {
  try {
    const filtros = validarFiltrosMovimientos(req.query);
    const where: WhereOptions = {};
    if (filtros.productoId)
      Object.assign(where, { productoId: filtros.productoId });
    if (filtros.tipo) Object.assign(where, { tipo: filtros.tipo });
    if (filtros.desde || filtros.hasta) {
      Object.assign(where, {
        fecha: {
          ...(filtros.desde ? { [Op.gte]: filtros.desde } : {}),
          ...(filtros.hasta ? { [Op.lte]: filtros.hasta } : {}),
        },
      });
    }

    const movimientos = await MovimientoStock.findAll({
      where,
      include: [
        { model: Producto, as: "producto", attributes: ["id", "nombre"] },
        { model: Usuario, as: "usuario", attributes: ["id", "nombreCompleto"] },
      ],
      order: [
        ["fecha", "DESC"],
        ["createdAt", "DESC"],
      ],
      limit: LIMITE_MOVIMIENTOS,
    });

    res.setHeader("X-Limite-Movimientos", String(LIMITE_MOVIMIENTOS));
    return res.json(movimientos);
  } catch (error) {
    return responderErrorStock(res, error, "Error al listar movimientos");
  }
}
