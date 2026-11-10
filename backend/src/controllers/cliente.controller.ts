import { Response } from "express";
import { Op, QueryTypes, WhereOptions } from "sequelize";
import { AuthRequest } from "../middlewares/auth.middleware";
import Cliente from "../models/Cliente";
import SaldoEnvase from "../models/SaldoEnvase";
import Producto from "../models/Producto";
import Barrio from "../models/Barrio";
import sequelize from "../config/database";
import { geocodificarDireccion } from "../utils/geocode";
import {
  cuerpoCliente,
  DatosClienteInvalidos,
  validarCliente,
  validarCoordenadas,
  validarDias,
} from "../utils/cliente.validation";
import { responderErrorCliente } from "../utils/cliente.error";
import { diasComercialesDesde, fechaComercial, rangoDiaComercial } from "../utils/fecha-comercial";

export async function crearCliente(req: AuthRequest, res: Response) {
  try {
    const datos = validarCliente(req.body, true);
    if (datos.barrioId && !(await Barrio.findByPk(datos.barrioId)))
      throw new DatosClienteInvalidos("El barrio no existe");
    if (datos.latitud === undefined && datos.direccion) {
      const coordenadas = await geocodificarDireccion(
        datos.direccion,
        datos.localidad,
      );
      Object.assign(datos, coordenadas ?? { latitud: null, longitud: null });
    }
    const cliente = await Cliente.create({
      ...datos,
      nombre: datos.nombre!,
      apellido: datos.apellido!,
    });
    return res.status(201).json(cliente);
  } catch (error) {
    return responderErrorCliente(res, error, "Error al crear cliente");
  }
}

export async function listarClientes(req: AuthRequest, res: Response) {
  try {
    const clientes = await Cliente.findAll({
      include: [
        {
          model: SaldoEnvase,
          as: "saldosEnvase",
          attributes: ["productoId", "cantidad"],
        },
        { model: Barrio, as: "barrio", attributes: ["id", "nombre"] },
      ],
      order: [
        ["apellido", "ASC"],
        ["nombre", "ASC"],
      ],
    });
    return res.json(clientes);
  } catch (error) {
    return responderErrorCliente(res, error, "Error al listar clientes");
  }
}

export async function listarDesactivados(req: AuthRequest, res: Response) {
  try {
    const clientes = await Cliente.findAll({
      paranoid: false,
      where: {
        deletedAt: { [Op.ne]: null },
      } as WhereOptions,
      include: [
        {
          model: SaldoEnvase,
          as: "saldosEnvase",
          attributes: ["productoId", "cantidad"],
        },
        { model: Barrio, as: "barrio", attributes: ["id", "nombre"] },
      ],
      order: [
        ["apellido", "ASC"],
        ["nombre", "ASC"],
      ],
    });
    return res.json(clientes);
  } catch (error) {
    return responderErrorCliente(res, error, "Error al listar clientes");
  }
}

export async function obtenerCliente(req: AuthRequest, res: Response) {
  try {
    const cliente = await Cliente.findByPk(req.params.id as string, {
      include: [{ model: Barrio, as: "barrio", attributes: ["id", "nombre"] }],
    });
    if (!cliente)
      return res.status(404).json({ error: "Cliente no encontrado" });
    return res.json(cliente);
  } catch (error) {
    return responderErrorCliente(res, error, "Error al obtener cliente");
  }
}

export async function actualizarCliente(req: AuthRequest, res: Response) {
  try {
    const datos = validarCliente(req.body, false);
    const cliente = await sequelize.transaction(async (transaction) => {
      const actual = await Cliente.findByPk(req.params.id as string, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!actual) return null;
      if (
        datos.barrioId &&
        !(await Barrio.findByPk(datos.barrioId, { transaction }))
      )
        throw new DatosClienteInvalidos("El barrio no existe");
      const cambioDireccion =
        datos.direccion !== undefined && datos.direccion !== actual.direccion;
      const cambioLocalidad =
        datos.localidad !== undefined && datos.localidad !== actual.localidad;
      if ((cambioDireccion || cambioLocalidad) && datos.latitud === undefined) {
        const direccion =
          datos.direccion === undefined ? actual.direccion : datos.direccion;
        const localidad =
          datos.localidad === undefined ? actual.localidad : datos.localidad;
        const coordenadas = direccion
          ? await geocodificarDireccion(direccion, localidad)
          : null;
        Object.assign(datos, coordenadas ?? { latitud: null, longitud: null });
      }
      return actual.update(datos, { transaction });
    });
    if (!cliente)
      return res.status(404).json({ error: "Cliente no encontrado" });
    return res.json(cliente);
  } catch (error) {
    return responderErrorCliente(res, error, "Error al actualizar cliente");
  }
}

export async function eliminarCliente(req: AuthRequest, res: Response) {
  try {
    const resultado = await sequelize.transaction(async (transaction) => {
      const cliente = await Cliente.findByPk(req.params.id as string, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!cliente) return "no-encontrado";
      if (cliente.saldoActual !== 0) return "pendientes";
      await cliente.destroy({ transaction });
      return "eliminado";
    });
    if (resultado === "no-encontrado")
      return res.status(404).json({ error: "Cliente no encontrado" });
    if (resultado === "pendientes")
      return res.status(409).json({
        error:
          "Resolver el saldo pendiente antes de dar de baja al cliente",
      });
    return res.status(204).send();
  } catch (error) {
    return responderErrorCliente(res, error, "Error al eliminar cliente");
  }
}

export async function obtenerSaldoEnvases(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    if (!(await Cliente.findByPk(id)))
      return res.status(404).json({ error: "Cliente no encontrado" });
    const saldos = await SaldoEnvase.findAll({
      where: { clienteId: id, cantidad: { [Op.ne]: 0 } },
      include: [
        { model: Producto, as: "producto", attributes: ["id", "nombre"] },
      ],
      order: [[{ model: Producto, as: "producto" }, "nombre", "ASC"]],
    });
    return res.json(saldos);
  } catch (error) {
    return responderErrorCliente(
      res,
      error,
      "Error al obtener saldo de envases",
    );
  }
}

export async function ajustarUbicacion(req: AuthRequest, res: Response) {
  try {
    const coordenadas = validarCoordenadas(cuerpoCliente(req.body));
    const cliente = await sequelize.transaction(async (transaction) => {
      const actual = await Cliente.findByPk(req.params.id as string, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      return actual ? actual.update(coordenadas, { transaction }) : null;
    });
    if (!cliente)
      return res.status(404).json({ error: "Cliente no encontrado" });
    return res.json(cliente);
  } catch (error) {
    return responderErrorCliente(res, error, "Error al ajustar ubicacion");
  }
}

export async function marcarVisita(req: AuthRequest, res: Response) {
  try {
    const { visitado } = cuerpoCliente(req.body);
    if (typeof visitado !== "boolean")
      throw new DatosClienteInvalidos("visitado debe ser booleano");
    const cliente = await sequelize.transaction(async (transaction) => {
      const actual = await Cliente.findByPk(req.params.id as string, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      return actual
        ? actual.update(
            { ultimaVisitaFecha: visitado ? fechaComercial() : null },
            { transaction },
          )
        : null;
    });
    if (!cliente)
      return res.status(404).json({ error: "Cliente no encontrado" });
    return res.json(cliente);
  } catch (error) {
    return responderErrorCliente(res, error, "Error al marcar visita");
  }
}

interface DeudaCliente {
  id: string;
  nombre: string;
  apellido: string;
  saldoActual: string | number;
  ultimoPago: Date | string | null;
  primeraEntrega: Date | string | null;
}

export async function listarDeudaVieja(req: AuthRequest, res: Response) {
  try {
    const dias = validarDias(req.query.dias);
    const resultados = await sequelize.query<DeudaCliente>(
      `
            SELECT c.id, c.nombre, c.apellido, c."saldoActual",
                MAX(CASE WHEN h."montoPagado" > 0 THEN h.fecha END) AS "ultimoPago",
                MIN(h.fecha) AS "primeraEntrega"
            FROM clientes c
            LEFT JOIN historiales h ON h."clienteId" = c.id
            WHERE c."saldoActual" > 0 AND c."deletedAt" IS NULL
            GROUP BY c.id, c.nombre, c.apellido, c."saldoActual"
        `,
      { type: QueryTypes.SELECT },
    );
    const hoy = new Date();
    const deudaVieja = resultados
      .flatMap((cliente) => {
        const referencia = cliente.ultimoPago ?? cliente.primeraEntrega;
        if (!referencia) return [];
        const diasSinPagar = diasComercialesDesde(new Date(referencia), hoy);
        if (diasSinPagar < dias) return [];
        return [
          {
            id: cliente.id,
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            saldoActual: Number(cliente.saldoActual),
            diasSinPagar,
          },
        ];
      })
      .sort((a, b) => b.diasSinPagar - a.diasSinPagar);
    return res.json(deudaVieja);
  } catch (error) {
    return responderErrorCliente(res, error, "Error al obtener deuda vieja");
  }
}

// Frecuente = al menos esta cantidad de entregas en los últimos 30 días (≈ una por semana).
export const ENTREGAS_CLIENTE_FRECUENTE = 4;

interface ActividadFila {
  clienteId: string;
  ultimaEntrega: Date | string | null;
  entregasUltimos30: number | string;
  activoMes: number | string;
}

// Para la lista de clientes: última entrega, si es frecuente y cuántos clientes recibieron algo este mes.
// Solo cuentan entregas con producto (un pago sin entrega no es una entrega).
export async function actividadClientes(req: AuthRequest, res: Response) {
  try {
    const hoy = fechaComercial();
    const inicioMes = rangoDiaComercial(`${hoy.slice(0, 7)}-01`).inicio;
    const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const filas = await sequelize.query<ActividadFila>(
      `
            SELECT h."clienteId",
                MAX(h.fecha) AS "ultimaEntrega",
                SUM(CASE WHEN h.fecha >= :hace30Dias THEN 1 ELSE 0 END) AS "entregasUltimos30",
                MAX(CASE WHEN h.fecha >= :inicioMes THEN 1 ELSE 0 END) AS "activoMes"
            FROM historiales h
            JOIN clientes c ON c.id = h."clienteId" AND c."deletedAt" IS NULL
            WHERE EXISTS (
                SELECT 1 FROM historial_detalles d
                WHERE d."historialId" = h.id AND d."cantidadEntregada" > 0
            )
            GROUP BY h."clienteId"
        `,
      { type: QueryTypes.SELECT, replacements: { hace30Dias, inicioMes } },
    );
    const clientes = filas.map((f) => {
      const entregasUltimos30 = Number(f.entregasUltimos30);
      return {
        clienteId: f.clienteId,
        ultimaEntrega: f.ultimaEntrega ? new Date(f.ultimaEntrega) : null,
        entregasUltimos30,
        frecuente: entregasUltimos30 >= ENTREGAS_CLIENTE_FRECUENTE,
      };
    });
    return res.json({
      activosMes: filas.filter((f) => Number(f.activoMes) === 1).length,
      clientes,
    });
  } catch (error) {
    return responderErrorCliente(res, error, "Error al obtener la actividad de clientes");
  }
}

export async function restaurarCliente(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const cliente = await Cliente.findByPk(id as string, {
      paranoid: false,
    });

    if (!cliente) {
      return res.status(404).json({
        error: "Cliente no encontrado",
      });
    }

    if (!cliente.deletedAt) {
      return res.status(409).json({
        error: "El cliente ya está activo",
      });
    }

    await cliente.restore();
    return res.json(cliente);
  } catch (error) {
    return responderErrorCliente(res, error, "Error al restaurar el cliente");
  }
}
