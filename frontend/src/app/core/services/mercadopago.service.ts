import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environments";
import { Observable } from "rxjs";
import { EstadoPago, PreferenciaPago } from "../models/mercadopago.model";

@Injectable({
    providedIn: 'root'
})

export class MercadopagoService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/mercadopago`;

    habilitado(): Observable<{ habilitado: boolean }> {
        return this.http.get<{ habilitado: boolean }>(`${this.baseUrl}/habilitado`);
    }

    crearPreferencia(monto: number, descripcion: string, referenciaExterna: string): Observable<PreferenciaPago> {
        return this.http.post<PreferenciaPago>(`${this.baseUrl}/preferencia`, {
            monto,
            descripcion,
            referenciaExterna,
        });
    }

    estadoPago(referenciaExterna: string): Observable<EstadoPago> {
        return this.http.get<EstadoPago>(`${this.baseUrl}/estado/${referenciaExterna}`);
    }
}