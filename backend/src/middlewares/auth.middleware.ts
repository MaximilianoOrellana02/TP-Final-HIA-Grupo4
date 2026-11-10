import { Request, Response, NextFunction } from 'express';
import Usuario, { RolUsuario } from '../models/Usuario';
import { Sesion, verificarSesion } from '../services/token.service';
import { responderErrorUsuario } from '../utils/usuario.error';

export interface AuthRequest extends Request {
    // El rol se lee de la base en cada request (no viaja en el token), asi un cambio de rol aplica al instante.
    usuario?: Sesion & { rol?: RolUsuario };
}

export async function verificarToken(req: AuthRequest, res: Response, next: NextFunction) {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ error: 'Token no proporcionado o invalido' });
    try {
        const payload = verificarSesion(match[1]);
        if (!payload) return res.status(401).json({ error: 'Token invalido o expirado' });
        const usuario = await Usuario.findByPk(payload.id);
        if (!usuario || usuario.sessionVersion !== payload.sessionVersion) {
            return res.status(401).json({ error: 'Usuario no encontrado o sesion invalida' });
        }
        req.usuario = { id: usuario.id, username: usuario.username, sessionVersion: usuario.sessionVersion, rol: usuario.rol };
    } catch (error) {
        return responderErrorUsuario(res, error, 'Error al verificar la sesion');
    }
    next();
}

export function esAdmin(req: AuthRequest): boolean {
    return req.usuario?.rol === 'admin';
}

// Va despues de verificarToken.
export function soloAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    if (!esAdmin(req)) return res.status(403).json({ error: 'Solo un administrador puede hacer esta operacion' });
    next();
}
