import { Pipe, PipeTransform } from '@angular/core';
import { Producto, precioVigente } from '../core/models/producto.model';

@Pipe({ name: 'precioParticular' })
export class PrecioParticularPipe implements PipeTransform {
    transform(producto: Producto): string {
        const precio = precioVigente(producto, 'particular');
        return precio != null ? `$${precio}` : '—';
    }
}

@Pipe({ name: 'precioConfianza' })
export class PrecioConfianzaPipe implements PipeTransform {
    transform(producto: Producto): string {
        const precio = precioVigente(producto, 'confianza');
        return precio != null ? `$${precio}` : '—';
    }
}