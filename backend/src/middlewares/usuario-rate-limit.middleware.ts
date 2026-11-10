import { rateLimit } from 'express-rate-limit';

export function limitarIntentos(limit: number) {
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { error: 'Demasiados intentos. Intenta nuevamente mas tarde.' },
    });
}
