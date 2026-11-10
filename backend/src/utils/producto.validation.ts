import { CANTIDAD_MAXIMA } from './stock.validation';

export const TIPOS_CLIENTE = ['particular', 'confianza'] as const;
export type TipoClientePrecio = typeof TIPOS_CLIENTE[number];
// DECIMAL(10,2) en la base: 8 enteros y 2 decimales.
export const PRECIO_MAXIMO = 99_999_999.99;
export const STOCK_MINIMO_MAXIMO = CANTIDAD_MAXIMA;

export class DatosProductoInvalidos extends Error {}
// Operacion valida en forma pero imposible con el estado actual (producto desactivado, ya desactivado).
export class ConflictoProducto extends Error {}

export interface ProductoInput {
    nombre?: string;
    esRetornable?: boolean;
    stockMinimo?: number;
    activo?: boolean;
}
export interface PreciosProducto { precioParticular: number; precioConfianza: number; }
export interface CambioPrecioInput { tipoCliente: TipoClientePrecio; precio: number; }
export interface FiltrosProductos { incluirInactivos: boolean; }

function tieneCampo(body: Record<string, unknown>, campo: string): boolean {
    return Object.prototype.hasOwnProperty.call(body, campo) && body[campo] !== undefined;
}

function cuerpo(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatosProductoInvalidos('El cuerpo debe ser un objeto JSON');
    return value as Record<string, unknown>;
}

export function nombreProducto(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
        throw new DatosProductoInvalidos('El nombre debe ser un texto de entre 1 y 100 caracteres');
    }
    return value.trim();
}

export function esPrecioValido(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= PRECIO_MAXIMO &&
        Math.round(value * 100) / 100 === value;
}

export function precioProducto(value: unknown, campo = 'precio'): number {
    if (!esPrecioValido(value)) {
        throw new DatosProductoInvalidos(`${campo} debe ser un numero mayor a 0, de hasta 2 decimales y no mayor a ${PRECIO_MAXIMO}`);
    }
    return value;
}

export function tipoClientePrecio(value: unknown): TipoClientePrecio {
    if (typeof value !== 'string' || !TIPOS_CLIENTE.includes(value as TipoClientePrecio)) {
        throw new DatosProductoInvalidos('tipoCliente debe ser "particular" o "confianza"');
    }
    return value as TipoClientePrecio;
}

export function stockMinimoProducto(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > STOCK_MINIMO_MAXIMO) {
        throw new DatosProductoInvalidos(`stockMinimo debe ser un entero entre 0 y ${STOCK_MINIMO_MAXIMO}`);
    }
    return value;
}

function booleano(value: unknown, campo: string): boolean {
    if (typeof value !== 'boolean') throw new DatosProductoInvalidos(`${campo} debe ser true o false`);
    return value;
}

export function validarProducto(value: unknown, crear: true): ProductoInput & PreciosProducto & { nombre: string };
export function validarProducto(value: unknown, crear: false): ProductoInput;
export function validarProducto(value: unknown, crear: boolean): ProductoInput & Partial<PreciosProducto> {
    const body = cuerpo(value);
    const datos: ProductoInput & Partial<PreciosProducto> = {};
    if (crear || tieneCampo(body, 'nombre')) datos.nombre = nombreProducto(body.nombre);
    if (tieneCampo(body, 'esRetornable')) datos.esRetornable = booleano(body.esRetornable, 'esRetornable');
    if (tieneCampo(body, 'stockMinimo')) datos.stockMinimo = stockMinimoProducto(body.stockMinimo);
    if (crear) {
        datos.precioParticular = precioProducto(body.precioParticular, 'precioParticular');
        datos.precioConfianza = precioProducto(body.precioConfianza, 'precioConfianza');
        return datos;
    }
    // Los precios solo los cambia un admin, con PUT /:id/precio; la edicion general del producto no los toca.
    if (['precio', 'precioParticular', 'precioConfianza'].some(campo => tieneCampo(body, campo))) {
        throw new DatosProductoInvalidos('Los precios se cambian con PUT /api/productos/:id/precio');
    }
    if (tieneCampo(body, 'activo')) datos.activo = booleano(body.activo, 'activo');
    if (!Object.keys(datos).length) throw new DatosProductoInvalidos('No hay campos de producto para actualizar');
    return datos;
}

export function validarCambioPrecio(value: unknown): CambioPrecioInput {
    const body = cuerpo(value);
    return { tipoCliente: tipoClientePrecio(body.tipoCliente), precio: precioProducto(body.precio) };
}

// Express 5 entrega req.query con strings, arrays u objetos; solo se aceptan "true" o "false".
export function validarFiltrosProductos(value: unknown): FiltrosProductos {
    const query = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    if (!tieneCampo(query, 'incluirInactivos')) return { incluirInactivos: false };
    if (query.incluirInactivos !== 'true' && query.incluirInactivos !== 'false') {
        throw new DatosProductoInvalidos('incluirInactivos debe ser "true" o "false"');
    }
    return { incluirInactivos: query.incluirInactivos === 'true' };
}
