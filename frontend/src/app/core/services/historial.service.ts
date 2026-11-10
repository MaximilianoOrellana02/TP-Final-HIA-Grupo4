import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environments";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Historial, HistorialInput, HistorialPage, ResumenHistorial, ResumenHoy } from "../models/historial.model";
import { map, Observable } from "rxjs";

@Injectable({
    providedIn: 'root'
})

export class HistorialService {
    private baseUrl = `${environment.apiUrl}/historial`;
    private http = inject(HttpClient);

    private normalizar(h: Historial): Historial {
        return {
            ...h,
            saldoAnterior: Number(h.saldoAnterior),
            importeTotal: Number(h.importeTotal),
            montoPagado: Number(h.montoPagado),
            saldoFinal: Number(h.saldoFinal),
        };
    }

    crearEntrega(entrega: HistorialInput): Observable<{ historial: Historial }> {
        return this.http.post<{ historial: Historial }>(this.baseUrl, entrega);
    }

    porCliente(clienteId: string): Observable<Historial[]> {
        return this.http
            .get<Historial[]>(`${this.baseUrl}/cliente/${clienteId}`)
            .pipe(map((lista) => lista.map((h) => this.normalizar(h))));
    }

    listar(params: { page?: number; limit?: number; desde?: string; hasta?: string } = {}): Observable<HistorialPage> {
        let httpParams = new HttpParams();
        if (params.page) httpParams = httpParams.set('page', params.page);
        if (params.limit) httpParams = httpParams.set('limit', params.limit);
        if (params.desde) httpParams = httpParams.set('desde', params.desde);
        if (params.hasta) httpParams = httpParams.set('hasta', params.hasta);

        return this.http
            .get<HistorialPage>(this.baseUrl, { params: httpParams })
            .pipe(map((pagina) => ({ ...pagina, data: pagina.data.map((h) => this.normalizar(h)) })));
    }

    resumen(params: { desde?: string; hasta?: string } = {}): Observable<ResumenHistorial> {
        let httpParams = new HttpParams();
        if (params.desde) httpParams = httpParams.set('desde', params.desde);
        if (params.hasta) httpParams = httpParams.set('hasta', params.hasta);
        return this.http.get<ResumenHistorial>(`${this.baseUrl}/resumen`, { params: httpParams });
    }

    resumenHoy(): Observable<ResumenHoy> {
        return this.http.get<ResumenHoy>(`${this.baseUrl}/resumen-hoy`);
    }
}