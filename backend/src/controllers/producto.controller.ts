import { Response } from 'express';
import { Op, Transaction, UniqueConstraintError, col, fn, where } from 'sequelize';
import { AuthRequest } from '../middlewares/auth.middleware';
import sequelize from '../config/database';
import Producto from '../models/Producto';
import { ConflictoProducto, validarCambioPrecio, validarFiltrosProductos, validarProducto } from '../utils/producto.validation';
import { responderErrorProducto } from '../utils/producto.error';

function buscarDuplicado(nombre: string, transaction: Transaction, excluirId?: string) {
    return Producto.findOne({
        where: {
            [Op.and]: [
                where(fn('LOWER', col('nombre')), nombre.toLowerCase()),
                ...(excluirId ? [{ id: { [Op.ne]: excluirId } }] : []),
            ],
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
    });
}

async function asegurarNombreLibre(nombre: string, transaction: Transaction, excluirId?: string) {
    if (await buscarDuplicado(nombre, transaction, excluirId)) throw new UniqueConstraintError({ message: 'Ese producto ya existe' });
}

function bloquearProducto(id: string, transaction: Transaction) {
    return Producto.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
}

export async function crearProducto(req: AuthRequest, res: Response) {
    try {
        const datos = validarProducto(req.body, true);
        const producto = await sequelize.transaction(async transaction => {
            const existente = await buscarDuplicado(datos.nombre, transaction);
            if (existente?.activo) throw new UniqueConstraintError({ message: 'Ese producto ya existe' });
            // Si existia dado de baja con el mismo nombre, se reactiva con los datos nuevos.
            return existente
                ? existente.update({ ...datos, activo: true }, { transaction })
                : Producto.create(datos, { transaction });
        });
        return res.status(201).json(producto);
    } catch (error) {
        return responderErrorProducto(res, error, 'Error al crear producto');
    }
}

export async function listarProductos(req: AuthRequest, res: Response) {
    try {
        const filtros = validarFiltrosProductos(req.query);
        const productos = await Producto.findAll({
            where: filtros.incluirInactivos ? {} : { activo: true },
            order: [['nombre', 'ASC']],
        });
        return res.json(productos);
    } catch (error) {
        return responderErrorProducto(res, error, 'Error al listar productos');
    }
}

export async function cambiarPrecio(req: AuthRequest, res: Response) {
    try {
        const { tipoCliente, precio } = validarCambioPrecio(req.body);
        const producto = await sequelize.transaction(async transaction => {
            const actual = await bloquearProducto(req.params.id as string, transaction);
            if (!actual) return null;
            if (!actual.activo) throw new ConflictoProducto('El producto esta desactivado; reactivarlo antes de cambiar el precio');
            const campo = tipoCliente === 'confianza' ? 'precioConfianza' : 'precioParticular';
            return actual.update({ [campo]: precio }, { transaction });
        });
        if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
        return res.json(producto);
    } catch (error) {
        return responderErrorProducto(res, error, 'Error al cambiar precio');
    }
}

export async function desactivarProducto(req: AuthRequest, res: Response) {
    try {
        const resultado = await sequelize.transaction(async transaction => {
            const producto = await bloquearProducto(req.params.id as string, transaction);
            if (!producto) return 'ausente';
            if (!producto.activo) return 'inactivo';
            await producto.update({ activo: false }, { transaction });
            return 'desactivado';
        });
        if (resultado === 'ausente') return res.status(404).json({ error: 'Producto no encontrado' });
        if (resultado === 'inactivo') return res.status(409).json({ error: 'El producto ya esta desactivado' });
        return res.status(204).send();
    } catch (error) {
        return responderErrorProducto(res, error, 'Error al desactivar producto');
    }
}

export async function actualizarProducto(req: AuthRequest, res: Response) {
    try {
        const datos = validarProducto(req.body, false);
        const producto = await sequelize.transaction(async transaction => {
            const actual = await bloquearProducto(req.params.id as string, transaction);
            if (!actual) return null;
            if (datos.nombre !== undefined) await asegurarNombreLibre(datos.nombre, transaction, actual.id);
            return actual.update(datos, { transaction });
        });
        if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
        return res.json(producto);
    } catch (error) {
        return responderErrorProducto(res, error, 'Error al actualizar producto');
    }
}
