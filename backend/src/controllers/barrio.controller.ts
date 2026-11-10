import { AuthRequest } from '../middlewares/auth.middleware';
import { Response } from 'express';
import { Op, Transaction, UniqueConstraintError, WhereOptions, col, fn, where } from 'sequelize';
import Barrio from '../models/Barrio';
import Cliente from '../models/Cliente';
import sequelize from '../config/database';
import { validarBarrio } from '../utils/barrio.validation';
import { responderErrorBarrio } from '../utils/barrio.error';

async function asegurarNombreLibre(nombre: string, transaction: Transaction, excluirId?: string) {
    const duplicado = await Barrio.findOne({
        where: {
            [Op.and]: [
                where(fn('LOWER', col('nombre')), nombre.toLowerCase()),
                ...(excluirId ? [{ id: { [Op.ne]: excluirId } }] : []),
            ],
        },
        transaction,
    });
    if (duplicado) throw new UniqueConstraintError({ message: 'Ese barrio ya existe' });
}

export async function listarBarrios(req: AuthRequest, res: Response) {
    try {
        return res.json(await Barrio.findAll({ order: [['nombre', 'ASC']] }));
    } catch (error) {
        return responderErrorBarrio(res, error, 'Error al listar barrios');
    }
}

export async function crearBarrio(req: AuthRequest, res: Response) {
    try {
        const datos = validarBarrio(req.body, true);
        const barrio = await sequelize.transaction(async transaction => {
            await asegurarNombreLibre(datos.nombre!, transaction);
            return Barrio.create({ ...datos, nombre: datos.nombre! }, { transaction });
        });
        return res.status(201).json(barrio);
    } catch (error) {
        return responderErrorBarrio(res, error, 'Error al crear barrio');
    }
}

export async function actualizarBarrio(req: AuthRequest, res: Response) {
    try {
        const datos = validarBarrio(req.body, false);
        const barrio = await sequelize.transaction(async transaction => {
            const actual = await Barrio.findByPk(req.params.id as string, { transaction, lock: transaction.LOCK.UPDATE });
            if (!actual) return null;
            if (datos.nombre !== undefined) await asegurarNombreLibre(datos.nombre, transaction, actual.id);
            return actual.update(datos, { transaction });
        });
        if (!barrio) return res.status(404).json({ error: 'Barrio no encontrado' });
        return res.json(barrio);
    } catch (error) {
        return responderErrorBarrio(res, error, 'Error al actualizar barrio');
    }
}

export async function eliminarBarrio(req: AuthRequest, res: Response) {
    try {
        const resultado = await sequelize.transaction(async transaction => {
            const barrio = await Barrio.findByPk(req.params.id as string, { transaction, lock: transaction.LOCK.UPDATE });
            if (!barrio) return 'ausente';
            const activos = await Cliente.count({ where: { barrioId: barrio.id }, transaction });
            if (activos) return 'ocupado';
            await Cliente.update({ barrioId: null }, {
                where: { barrioId: barrio.id, deletedAt: { [Op.ne]: null } } as WhereOptions,
                paranoid: false,
                transaction,
            });
            await barrio.destroy({ transaction });
            return 'borrado';
        });
        if (resultado === 'ausente') return res.status(404).json({ error: 'Barrio no encontrado' });
        if (resultado === 'ocupado') return res.status(409).json({ error: 'El barrio tiene clientes activos y no se puede eliminar' });
        return res.status(204).send();
    } catch (error) {
        return responderErrorBarrio(res, error, 'Error al eliminar barrio');
    }
}
