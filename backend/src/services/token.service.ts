import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';

const issuer = 'soderia-backend';
const audience = 'soderia-api';

function secret(): string {
    const value = process.env.JWT_SECRET;
    if (!value) throw new Error('JWT_SECRET es obligatorio');
    return value;
}

export interface Sesion {
    id: string;
    username: string;
    sessionVersion: number;
}

export function crearSesion(usuario: Sesion): string {
    return jwt.sign({ id: usuario.id, username: usuario.username, sessionVersion: usuario.sessionVersion, proposito: 'access' }, secret(), {
        algorithm: 'HS256', expiresIn: '7d', issuer, audience,
    });
}

export function verificarSesion(token: string): Sesion | null {
    const key = secret();
    try {
        const payload = jwt.verify(token, key, { algorithms: ['HS256'], issuer, audience });
        if (typeof payload === 'string' || payload.proposito !== 'access' ||
            typeof payload.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.id) ||
            typeof payload.username !== 'string' || !payload.username.trim() ||
            !Number.isSafeInteger(payload.sessionVersion) || payload.sessionVersion < 0 ||
            typeof payload.exp !== 'number') return null;
        return { id: payload.id, username: payload.username, sessionVersion: payload.sessionVersion };
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) return null;
        throw error;
    }
}

export function hashRecuperacion(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function crearRecuperacion() {
    const token = randomBytes(32).toString('hex');
    return { token, hash: hashRecuperacion(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) };
}
