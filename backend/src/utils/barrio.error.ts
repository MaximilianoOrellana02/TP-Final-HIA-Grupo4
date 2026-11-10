import { Response } from 'express';
import { ConnectionError, ForeignKeyConstraintError, UniqueConstraintError, ValidationError } from 'sequelize';
import { DatosBarrioInvalidos } from './barrio.validation';

export function responderErrorBarrio(res: Response, error: unknown, mensaje: string) {
    if (error instanceof DatosBarrioInvalidos) return res.status(400).json({ error: error.message });
    if (error instanceof UniqueConstraintError) return res.status(409).json({ error: 'Ese barrio ya existe' });
    if (error instanceof ValidationError) return res.status(400).json({ error: error.errors[0]?.message || 'Datos de barrio invalidos' });
    if (error instanceof ForeignKeyConstraintError) return res.status(409).json({ error: 'El barrio tiene clientes asociados y no se puede eliminar' });
    console.error(mensaje, error instanceof Error ? error.name + ': ' + error.message : 'UnknownError');
    return res.status(error instanceof ConnectionError ? 503 : 500).json({ error: mensaje });
}
