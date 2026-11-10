import { Request } from 'express';
import validator from 'validator';

export const ROLES_USUARIO = ['admin', 'repartidor'] as const;
export type RolUsuario = typeof ROLES_USUARIO[number];

export function cuerpo(req: Request): Record<string, unknown> {
    return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
}

export function texto(value: unknown, max: number): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

export function emailValido(value: unknown): string | null {
    const email = texto(value, 150)?.toLowerCase();
    return email && validator.isEmail(email) ? email : null;
}

export function passwordValida(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length >= 6 && Buffer.byteLength(value, 'utf8') <= 72;
}

export function passwordLoginValida(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= 72;
}

// Sin rol se registra un repartidor; solo se aceptan los roles conocidos.
export function rolValido(value: unknown): RolUsuario | null {
    if (value === undefined) return 'repartidor';
    return typeof value === 'string' && (ROLES_USUARIO as readonly string[]).includes(value) ? value as RolUsuario : null;
}
