import { esUuid } from './cliente.validation';

export const TIPOS_MOVIMIENTO = ['entrada', 'salida'] as const;
export type TipoMovimiento = typeof TIPOS_MOVIMIENTO[number];
export const CANTIDAD_MAXIMA = 1_000_000;
export const LIMITE_MOVIMIENTOS = 1000;

export class DatosStockInvalidos extends Error {}
// Operacion valida en forma pero imposible con el estado actual (stock insuficiente, producto desactivado).
export class ConflictoStock extends Error {}

export interface MovimientoInput {
    productoId: string;
    tipo: TipoMovimiento;
    cantidad: number;
    motivo: string | null;
}

export interface FiltrosMovimientos {
    productoId?: string;
    tipo?: TipoMovimiento;
    desde?: Date;
    hasta?: Date;
}

function tieneCampo(body: Record<string, unknown>, campo: string): boolean {
    return Object.prototype.hasOwnProperty.call(body, campo) && body[campo] !== undefined;
}

export function tipoMovimiento(value: unknown): TipoMovimiento {
    if (typeof value !== 'string' || !TIPOS_MOVIMIENTO.includes(value as TipoMovimiento)) {
        throw new DatosStockInvalidos('tipo debe ser "entrada" o "salida"');
    }
    return value as TipoMovimiento;
}

export function cantidadStock(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > CANTIDAD_MAXIMA) {
        throw new DatosStockInvalidos(`cantidad debe ser un entero entre 1 y ${CANTIDAD_MAXIMA}`);
    }
    return value;
}

export function motivoStock(value: unknown, tipo: TipoMovimiento): string | null {
    const vacio = value === undefined || value === null || (typeof value === 'string' && !value.trim());
    if (vacio) {
        if (tipo === 'salida') throw new DatosStockInvalidos('El motivo es obligatorio para una salida');
        return null;
    }
    if (typeof value !== 'string' || value.trim().length > 255) {
        throw new DatosStockInvalidos('motivo debe ser un texto de hasta 255 caracteres');
    }
    return value.trim();
}

export function validarMovimiento(value: unknown): MovimientoInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatosStockInvalidos('El cuerpo debe ser un objeto JSON');
    const body = value as Record<string, unknown>;
    if (!esUuid(body.productoId)) throw new DatosStockInvalidos('productoId debe ser un UUID');
    const tipo = tipoMovimiento(body.tipo);
    return { productoId: body.productoId, tipo, cantidad: cantidadStock(body.cantidad), motivo: motivoStock(body.motivo, tipo) };
}

function fechaFiltro(value: unknown, campo: string): Date {
    const fecha = typeof value === 'string' && value.trim() ? new Date(value) : new Date(NaN);
    if (Number.isNaN(fecha.getTime())) throw new DatosStockInvalidos(`${campo} debe ser una fecha valida (ISO 8601)`);
    return fecha;
}

// Express 5 entrega req.query con strings, arrays u objetos; solo se aceptan strings simples.
export function validarFiltrosMovimientos(value: unknown): FiltrosMovimientos {
    const query = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const filtros: FiltrosMovimientos = {};
    if (tieneCampo(query, 'productoId')) {
        if (!esUuid(query.productoId)) throw new DatosStockInvalidos('productoId debe ser un UUID');
        filtros.productoId = query.productoId;
    }
    if (tieneCampo(query, 'tipo')) filtros.tipo = tipoMovimiento(query.tipo);
    if (tieneCampo(query, 'desde')) filtros.desde = fechaFiltro(query.desde, 'desde');
    if (tieneCampo(query, 'hasta')) filtros.hasta = fechaFiltro(query.hasta, 'hasta');
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) throw new DatosStockInvalidos('desde no puede ser posterior a hasta');
    return filtros;
}
