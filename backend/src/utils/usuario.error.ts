import { Response } from 'express';
import { ConnectionError, UniqueConstraintError, ValidationError } from 'sequelize';

export function responderErrorUsuario(res: Response, error: unknown, mensaje: string) {
    if (error instanceof UniqueConstraintError) {
        return res.status(409).json({ error: 'El username o email ya esta registrado' });
    }
    if (error instanceof ValidationError) {
        return res.status(400).json({ error: 'Datos de usuario invalidos' });
    }
    // Sequelize puede incluir hashes y datos del usuario en sus errores completos.
    console.error(mensaje, error instanceof Error ? error.name : 'UnknownError');
    return res.status(error instanceof ConnectionError ? 503 : 500).json({ error: mensaje });
}
