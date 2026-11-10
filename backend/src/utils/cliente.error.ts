import { Response } from 'express';
import { ConnectionError, ForeignKeyConstraintError, ValidationError } from 'sequelize';
import { DatosClienteInvalidos } from './cliente.validation';

export function responderErrorCliente(res: Response, error: unknown, mensaje: string) {
    if (error instanceof DatosClienteInvalidos) return res.status(400).json({ error: error.message });
    if (error instanceof ValidationError) return res.status(400).json({ error: 'Datos de cliente invalidos' });
    if (error instanceof ForeignKeyConstraintError) return res.status(409).json({ error: 'La operacion entra en conflicto con datos relacionados' });
    console.error(mensaje, error instanceof Error ? error.name : 'UnknownError');
    return res.status(error instanceof ConnectionError ? 503 : 500).json({ error: mensaje });
}
