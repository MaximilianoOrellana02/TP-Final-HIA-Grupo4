import { Response } from 'express';
import { ConnectionError, ForeignKeyConstraintError, UniqueConstraintError, ValidationError } from 'sequelize';
import { ConflictoStock, DatosStockInvalidos } from './stock.validation';

export function responderErrorStock(res: Response, error: unknown, mensaje: string) {
    if (error instanceof DatosStockInvalidos) return res.status(400).json({ error: error.message });
    if (error instanceof ConflictoStock) return res.status(409).json({ error: error.message });
    // Va antes que ValidationError, de la que hereda (nombre de camioneta repetido, fila de stock duplicada).
    if (error instanceof UniqueConstraintError) return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
    if (error instanceof ValidationError) return res.status(400).json({ error: error.errors[0]?.message || 'Datos de stock invalidos' });
    if (error instanceof ForeignKeyConstraintError) return res.status(409).json({ error: 'La operacion entra en conflicto con datos relacionados' });
    console.error(mensaje, error instanceof Error ? error.name + ': ' + error.message : 'UnknownError');
    return res.status(error instanceof ConnectionError ? 503 : 500).json({ error: mensaje });
}
