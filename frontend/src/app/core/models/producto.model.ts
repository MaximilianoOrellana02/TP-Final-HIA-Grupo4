import { TipoCliente } from './cliente.model';

export interface Producto {
    id: string;
    nombre: string;
    esRetornable: boolean;
    activo: boolean;
    stockActual: number;
    stockMinimo: number;
    precioParticular: number;
    precioConfianza: number;
}

export interface ProductoInput {
    nombre: string;
    esRetornable?: boolean;
    precioParticular: number;
    precioConfianza: number;
}

export interface MovimientoStock {
    id: string;
    productoId: string;
    usuarioId: string;
    tipo: 'entrada' | 'salida';
    cantidad: number;
    motivo: string | null;
    fecha: string;
    producto?: { id: string; nombre: string };
    usuario?: { id: string; nombreCompleto: string };
}

// Precio del producto para un tipo de cliente.
export function precioVigente(producto: Producto, tipoCliente: TipoCliente): number | null {
    const precio = tipoCliente === 'confianza' ? producto.precioConfianza : producto.precioParticular;
    return precio == null ? null : Number(precio);
}