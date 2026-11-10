import { Response } from 'express';
import { ConnectionError, ForeignKeyConstraintError, UniqueConstraintError, ValidationError } from 'sequelize';
import { ConflictoProducto, DatosProductoInvalidos } from './producto.validation';

export function responderErrorProducto(res: Response, error: unknown, mensaje: string) {
    if (error instanceof DatosProductoInvalidos) return res.status(400).json({ error: error.message });
    if (error instanceof ConflictoProducto) return res.status(409).json({ error: error.message });
    if (error instanceof UniqueConstraintError) return res.status(409).json({ error: 'Ese producto ya existe' });
    if (error instanceof ValidationError) return res.status(400).json({ error: error.errors[0]?.message || 'Datos de producto invalidos' });
    if (error instanceof ForeignKeyConstraintError) return res.status(409).json({ error: 'El producto tiene datos relacionados y no admite la operacion' });
    console.error(mensaje, error instanceof Error ? error.name + ': ' + error.message : 'UnknownError');
    return res.status(error instanceof ConnectionError ? 503 : 500).json({ error: mensaje });
}
