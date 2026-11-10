import { Response } from 'express';
import { ConnectionError, ForeignKeyConstraintError, ValidationError } from 'sequelize';
import { ConflictoHistorial, DatosHistorialInvalidos, RecursoHistorialAusente } from './historial.validation';

export function responderErrorHistorial(res: Response, error: unknown, mensaje: string) {
    if (error instanceof DatosHistorialInvalidos) return res.status(400).json({ error: error.message });
    if (error instanceof RecursoHistorialAusente) return res.status(404).json({ error: error.message });
    if (error instanceof ConflictoHistorial) return res.status(409).json({ error: error.message });
    if (error instanceof ValidationError) return res.status(400).json({ error: error.errors[0]?.message || 'Datos de historial invalidos' });
    if (error instanceof ForeignKeyConstraintError) return res.status(409).json({ error: 'La entrega entra en conflicto con datos relacionados' });
    console.error(mensaje, error instanceof Error ? error.name + ': ' + error.message : 'UnknownError');
    return res.status(error instanceof ConnectionError ? 503 : 500).json({ error: mensaje });
}
