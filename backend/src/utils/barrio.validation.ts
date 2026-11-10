export const DIAS_VISITA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
export type DiaVisita = typeof DIAS_VISITA[number];
export class DatosBarrioInvalidos extends Error {}

export function nombreBarrio(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
        throw new DatosBarrioInvalidos('El nombre debe tener entre 1 y 100 caracteres');
    }
    return value.trim();
}

export function diasBarrio(value: unknown): DiaVisita[] {
    if (!Array.isArray(value) || value.length > 7 ||
        value.some(dia => typeof dia !== 'string' || !DIAS_VISITA.includes(dia as DiaVisita)) ||
        new Set(value).size !== value.length) {
        throw new DatosBarrioInvalidos('diasVisita debe ser una lista de dias validos sin repetidos');
    }
    // Se guarda siempre en orden de semana, sin importar el orden en que llegaron.
    return (value as DiaVisita[]).slice().sort((a, b) => DIAS_VISITA.indexOf(a) - DIAS_VISITA.indexOf(b));
}

export function validarBarrio(value: unknown, crear: boolean): { nombre?: string; diasVisita?: DiaVisita[] } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatosBarrioInvalidos('El cuerpo debe ser un objeto JSON');
    const body = value as Record<string, unknown>;
    const datos: { nombre?: string; diasVisita?: DiaVisita[] } = {};
    if (crear || Object.prototype.hasOwnProperty.call(body, 'nombre')) datos.nombre = nombreBarrio(body.nombre);
    if (Object.prototype.hasOwnProperty.call(body, 'diasVisita')) datos.diasVisita = diasBarrio(body.diasVisita);
    if (!crear && !Object.keys(datos).length) throw new DatosBarrioInvalidos('No hay campos de barrio para actualizar');
    return datos;
}
