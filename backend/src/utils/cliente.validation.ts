import validator from 'validator';
import type { ClienteCreationAttributes } from '../models/Cliente';

export class DatosClienteInvalidos extends Error {}
const tieneCampo = (body: Record<string, unknown>, campo: string) => Object.prototype.hasOwnProperty.call(body, campo);

export function esUuid(value: unknown): value is string {
    return typeof value === 'string' && validator.isUUID(value);
}

// Validador para modelos Sequelize: acepta cualquier version de UUID. Los usuarios sembrados con UUID() de MySQL
// son version 1, asi que isUUID: 4 los rechazaba.
export function uuidDeModelo(value: unknown) {
    if (!esUuid(value)) throw new Error('Debe ser un UUID');
}

export function cuerpoCliente(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatosClienteInvalidos('El cuerpo debe ser un objeto JSON');
    return value as Record<string, unknown>;
}

export function coordenadasValidas(latitud: unknown, longitud: unknown): boolean {
    return typeof latitud === 'number' && Number.isFinite(latitud) && Math.abs(latitud) <= 90 &&
        typeof longitud === 'number' && Number.isFinite(longitud) && Math.abs(longitud) <= 180;
}

export function validarCoordenadas(body: Record<string, unknown>, permitirNull = true) {
    const { latitud, longitud } = body;
    if (permitirNull && latitud === null && longitud === null) return { latitud: null, longitud: null };
    if (!coordenadasValidas(latitud, longitud)) throw new DatosClienteInvalidos('Enviar latitud y longitud numericas validas juntas');
    return { latitud: latitud as number, longitud: longitud as number };
}

export function validarCliente(value: unknown, crear: boolean): Partial<ClienteCreationAttributes> {
    const body = cuerpoCliente(value);
    const datos: Partial<ClienteCreationAttributes> = {};
    for (const campo of ['nombre', 'apellido'] as const) {
        if (crear || tieneCampo(body, campo)) {
            const texto = body[campo];
            if (typeof texto !== 'string' || !texto.trim() || texto.trim().length > 100) throw new DatosClienteInvalidos(`${campo} debe tener entre 1 y 100 caracteres`);
            datos[campo] = texto.trim();
        }
    }
    for (const [campo, max] of [['direccion', 200], ['telefono', 30], ['localidad', 100], ['notaRepartidor', 255], ['referencia', 100]] as const) {
        if (tieneCampo(body, campo)) {
            const texto = body[campo];
            if (texto !== null && (typeof texto !== 'string' || texto.trim().length > max)) throw new DatosClienteInvalidos(`${campo} invalido`);
            datos[campo] = typeof texto === 'string' ? texto.trim() || null : null;
        }
    }
    if (tieneCampo(body, 'tipoCliente')) {
        if (body.tipoCliente !== 'particular' && body.tipoCliente !== 'confianza') throw new DatosClienteInvalidos('Tipo de cliente invalido');
        datos.tipoCliente = body.tipoCliente;
    }
    if (tieneCampo(body, 'categoria')) {
        if (body.categoria !== 'domicilio' && body.categoria !== 'restaurante') throw new DatosClienteInvalidos('Categoria invalida');
        datos.categoria = body.categoria;
    }
    if (tieneCampo(body, 'barrioId')) {
        if (body.barrioId !== null && !esUuid(body.barrioId)) throw new DatosClienteInvalidos('barrioId debe ser UUID o null');
        datos.barrioId = body.barrioId as string | null;
    }
    if (tieneCampo(body, 'latitud') || tieneCampo(body, 'longitud')) Object.assign(datos, validarCoordenadas(body));
    if (!crear && !Object.keys(datos).length) throw new DatosClienteInvalidos('No hay campos de cliente para actualizar');
    return datos;
}

export function validarDias(value: unknown): number {
    if (value === undefined) return 30;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new DatosClienteInvalidos('dias debe ser un entero entre 0 y 36500');
    const dias = Number(value);
    if (!Number.isSafeInteger(dias) || dias > 36500) throw new DatosClienteInvalidos('dias debe ser un entero entre 0 y 36500');
    return dias;
}
