import { esUuid } from './cliente.validation';
import { CANTIDAD_MAXIMA } from './stock.validation';
import { PRECIO_MAXIMO } from './producto.validation';
import { esDiaComercial, rangoDiaComercial } from './fecha-comercial';

export const METODOS_PAGO = ['efectivo', 'transferencia', 'mercadopago'] as const;
export type MetodoPago = typeof METODOS_PAGO[number];
export const OBSERVACION_MAXIMA = 255;
export const IMPORTE_MAXIMO = PRECIO_MAXIMO;
export const LIMITE_PAGINA = 100;
export const LIMITE_PAGINA_CLIENTE = 500;

export class DatosHistorialInvalidos extends Error {}
// Recurso referenciado por la operacion que no existe (producto de una linea).
export class RecursoHistorialAusente extends Error {}
// Operacion valida en forma pero imposible con el estado actual (producto desactivado, stock insuficiente).
export class ConflictoHistorial extends Error {}

export interface DetalleEntregaInput {
    productoId: string;
    cantidadEntregada: number;
    cantidadEnvaseDevuelto: number;
    precioUnitario?: number;
}
export interface AjusteSaldoInput {
    saldoEsperado: number;
    saldoNuevo: number;
    motivo: string;
}
export interface EntregaInput {
    clienteId: string;
    montoPagado: number;
    metodoPago: MetodoPago;
    observacion: string | null;
    detalles: DetalleEntregaInput[];
    ajusteSaldo?: AjusteSaldoInput;
}
export interface RangoFechas { desde?: Date; hasta?: Date; }
export interface FiltrosHistorial extends RangoFechas { page: number; limit: number; }

// Los importes se manejan siempre con dos decimales para que saldos y totales no arrastren restos binarios.
export function redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
}

function tieneCampo(body: Record<string, unknown>, campo: string): boolean {
    return Object.prototype.hasOwnProperty.call(body, campo) && body[campo] !== undefined;
}

function cuerpo(value: unknown, descripcion = 'El cuerpo'): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatosHistorialInvalidos(`${descripcion} debe ser un objeto JSON`);
    return value as Record<string, unknown>;
}

export function importeHistorial(value: unknown, campo: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > IMPORTE_MAXIMO || redondear(value) !== value) {
        throw new DatosHistorialInvalidos(`${campo} debe ser un numero entre 0 y ${IMPORTE_MAXIMO} con hasta 2 decimales`);
    }
    return value;
}

export function cantidadHistorial(value: unknown, campo: string): number {
    if (value === undefined || value === null) return 0;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > CANTIDAD_MAXIMA) {
        throw new DatosHistorialInvalidos(`${campo} debe ser un entero entre 0 y ${CANTIDAD_MAXIMA}`);
    }
    return value;
}

export function metodoPagoHistorial(value: unknown): MetodoPago {
    if (value === undefined || value === null) return 'efectivo';
    if (typeof value !== 'string' || !METODOS_PAGO.includes(value as MetodoPago)) {
        throw new DatosHistorialInvalidos(`metodoPago debe ser uno de: ${METODOS_PAGO.join(', ')}`);
    }
    return value as MetodoPago;
}

export function observacionHistorial(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string' || value.trim().length > OBSERVACION_MAXIMA) {
        throw new DatosHistorialInvalidos(`observacion debe ser un texto de hasta ${OBSERVACION_MAXIMA} caracteres`);
    }
    return value.trim() || null;
}

function detalleEntrega(value: unknown, posicion: number): DetalleEntregaInput {
    const linea = cuerpo(value, `detalles[${posicion}]`);
    if (!esUuid(linea.productoId)) throw new DatosHistorialInvalidos(`detalles[${posicion}].productoId debe ser un UUID`);
    const detalle: DetalleEntregaInput = {
        productoId: linea.productoId,
        cantidadEntregada: cantidadHistorial(linea.cantidadEntregada, `detalles[${posicion}].cantidadEntregada`),
        cantidadEnvaseDevuelto: cantidadHistorial(linea.cantidadEnvaseDevuelto, `detalles[${posicion}].cantidadEnvaseDevuelto`),
    };
    if (!detalle.cantidadEntregada && !detalle.cantidadEnvaseDevuelto) {
        throw new DatosHistorialInvalidos(`detalles[${posicion}] debe entregar o recibir al menos una unidad`);
    }
    // Un precio manual solo se acepta explicito; si falta se usa el vigente para el tipo de cliente.
    if (linea.precioUnitario !== undefined && linea.precioUnitario !== null) {
        detalle.precioUnitario = importeHistorial(linea.precioUnitario, `detalles[${posicion}].precioUnitario`);
    }
    return detalle;
}

function validarAjusteSaldo(value: unknown): AjusteSaldoInput {
    const ajuste = cuerpo(value, 'ajusteSaldo');
    const esperado = ajuste.saldoEsperado;
    if (typeof esperado !== 'number' || !Number.isFinite(esperado) || Math.abs(esperado) > IMPORTE_MAXIMO || redondear(esperado) !== esperado) {
        throw new DatosHistorialInvalidos('saldoEsperado debe ser un saldo valido con hasta 2 decimales');
    }
    const saldoNuevo = importeHistorial(ajuste.saldoNuevo, 'saldoNuevo');
    const motivo = observacionHistorial(ajuste.motivo);
    if (!motivo) throw new DatosHistorialInvalidos('Indicar el motivo del ajuste de saldo');
    if (saldoNuevo === esperado) throw new DatosHistorialInvalidos('El nuevo saldo debe ser distinto del saldo actual');
    return { saldoEsperado: esperado, saldoNuevo, motivo };
}

export function validarEntrega(value: unknown): EntregaInput {
    const body = cuerpo(value);
    if (!esUuid(body.clienteId)) throw new DatosHistorialInvalidos('clienteId debe ser un UUID');
    const montoPagado = body.montoPagado === undefined || body.montoPagado === null ? 0 : importeHistorial(body.montoPagado, 'montoPagado');
    let detalles: DetalleEntregaInput[] = [];
    if (body.detalles !== undefined && body.detalles !== null) {
        if (!Array.isArray(body.detalles)) throw new DatosHistorialInvalidos('detalles debe ser una lista');
        detalles = body.detalles.map(detalleEntrega);
    }
    if (new Set(detalles.map(d => d.productoId)).size !== detalles.length) {
        throw new DatosHistorialInvalidos('Cada producto puede aparecer una sola vez en detalles');
    }
    if (!detalles.length && montoPagado === 0) throw new DatosHistorialInvalidos('Cargar al menos un producto o un monto pagado');
    return {
        clienteId: body.clienteId, montoPagado, metodoPago: metodoPagoHistorial(body.metodoPago),
        observacion: observacionHistorial(body.observacion), detalles,
        ...(body.ajusteSaldo !== undefined ? { ajusteSaldo: validarAjusteSaldo(body.ajusteSaldo) } : {}),
    };
}

// Acepta fechas ISO 8601 o un dia (YYYY-MM-DD), que se interpreta como dia comercial completo de Argentina:
// desde=2026-01-01 empieza a las 00:00 de ese dia y hasta=2026-01-31 llega hasta las 23:59:59.999.
function fechaFiltro(value: unknown, campo: 'desde' | 'hasta'): Date {
    if (esDiaComercial(value)) return rangoDiaComercial(value)[campo === 'desde' ? 'inicio' : 'fin'];
    // Un dia con formato correcto pero inexistente (2026-02-30) no debe caer en el parseo ISO, que lo desborda.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DatosHistorialInvalidos(`${campo} no es un dia valido (YYYY-MM-DD)`);
    const fecha = typeof value === 'string' && value.trim() ? new Date(value) : new Date(NaN);
    if (Number.isNaN(fecha.getTime())) throw new DatosHistorialInvalidos(`${campo} debe ser una fecha valida (ISO 8601 o YYYY-MM-DD)`);
    return fecha;
}

function enteroQuery(value: unknown, campo: string, minimo: number, maximo: number, porDefecto: number): number {
    if (value === undefined) return porDefecto;
    if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < minimo || Number(value) > maximo) {
        throw new DatosHistorialInvalidos(`${campo} debe ser un entero entre ${minimo} y ${maximo}`);
    }
    return Number(value);
}

// Express 5 entrega req.query con strings, arrays u objetos; solo se aceptan strings simples.
export function validarRangoFechas(value: unknown): RangoFechas {
    const query = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const rango: RangoFechas = {};
    if (tieneCampo(query, 'desde')) rango.desde = fechaFiltro(query.desde, 'desde');
    if (tieneCampo(query, 'hasta')) rango.hasta = fechaFiltro(query.hasta, 'hasta');
    if (rango.desde && rango.hasta && rango.desde > rango.hasta) throw new DatosHistorialInvalidos('desde no puede ser posterior a hasta');
    return rango;
}

export function validarFiltrosHistorial(value: unknown, limiteMaximo = LIMITE_PAGINA, limitePorDefecto = 20): FiltrosHistorial {
    const query = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    return {
        ...validarRangoFechas(query),
        page: enteroQuery(query.page, 'page', 1, 1_000_000, 1),
        limit: enteroQuery(query.limit, 'limit', 1, limiteMaximo, limitePorDefecto),
    };
}
