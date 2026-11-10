import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environments";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { MovimientoStock, Producto, ProductoInput } from "../models/producto.model";
import { TipoCliente } from "../models/cliente.model";

@Injectable({
    providedIn: 'root'
})

export class ProductoService {
    private baseUrl = `${environment.apiUrl}/productos`;
    private http = inject(HttpClient);

    listar(): Observable<Producto[]> {
        return this.http.get<Producto[]>(this.baseUrl);
    }

    crear(producto: ProductoInput): Observable<Producto> {
        return this.http.post<Producto>(this.baseUrl, producto);
    }

    cambiarPrecio(id: string, tipoCliente: TipoCliente, precio: number): Observable<unknown> {
        return this.http.put(`${this.baseUrl}/${id}/precio`, { tipoCliente, precio });
    }

    desactivar(id: string): Observable<Producto> {
        return this.http.delete<Producto>(`${this.baseUrl}/${id}`);
    }

    actualizar(id: string, cambios: { nombre?: string; esRetornable?: boolean; stockMinimo?: number }): Observable<Producto> {
        return this.http.put<Producto>(`${this.baseUrl}/${id}`, cambios);
    }

    crearMovimientoStock(productoId: string, tipo: 'entrada' | 'salida', cantidad: number, motivo?: string): Observable<MovimientoStock> {
        return this.http.post<MovimientoStock>(`${environment.apiUrl}/stock/movimientos`, {
            productoId,
            tipo,
            cantidad,
            motivo,
        });
    }

    listarMovimientosStock(filtros: { productoId?: string; tipo?: 'entrada' | 'salida'; desde?: string; hasta?: string } = {}): Observable<MovimientoStock[]> {
        let params = new HttpParams();
        if (filtros.productoId) params = params.set('productoId', filtros.productoId);
        if (filtros.tipo) params = params.set('tipo', filtros.tipo);
        if (filtros.desde) params = params.set('desde', filtros.desde);
        if (filtros.hasta) params = params.set('hasta', filtros.hasta);

        return this.http.get<MovimientoStock[]>(`${environment.apiUrl}/stock/movimientos`, { params });
    }
}