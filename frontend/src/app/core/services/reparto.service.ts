import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Reparto, ResumenReparto } from '../models/reparto.model';

// Reparto del día del usuario (lo guarda el backend: vale en cualquier dispositivo) y el resumen al terminarlo.
@Injectable({ providedIn: 'root' })
export class RepartoService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/repartos/hoy`;

    // undefined = todavía no se consultó; null = hoy no empezó.
    repartoHoy = signal<Reparto | null | undefined>(undefined);
    resumen = signal<ResumenReparto | null>(null);
    verResumen = signal(false);

    comenzadoHoy = computed<boolean | undefined>(() => {
        const reparto = this.repartoHoy();
        return reparto === undefined ? undefined : reparto !== null;
    });
    terminadoHoy = computed(() => !!this.repartoHoy()?.finalizadoEn);

    cargarRepartoHoy(): Observable<Reparto | null> {
        return this.http.get<{ reparto: Reparto | null; resumen: ResumenReparto | null }>(this.baseUrl).pipe(
            tap(({ reparto, resumen }) => {
                this.repartoHoy.set(reparto);
                this.resumen.set(resumen);
            }),
            map(({ reparto }) => reparto),
        );
    }

    // Empieza el reparto de hoy. Repetirlo no duplica nada.
    registrarComienzo(): Observable<Reparto> {
        return this.http.post<Reparto>(`${this.baseUrl}/comenzar`, {}).pipe(tap((reparto) => this.repartoHoy.set(reparto)));
    }

    terminar(): Observable<ResumenReparto> {
        return this.http.post<{ reparto: Reparto; resumen: ResumenReparto }>(`${this.baseUrl}/terminar`, {}).pipe(
            tap(({ reparto, resumen }) => {
                this.repartoHoy.set(reparto);
                this.resumen.set(resumen);
            }),
            map(({ resumen }) => resumen),
        );
    }

    // "Cancelar fin de reparto": vuelve a quedar en curso (solo el de hoy).
    reabrir(): Observable<Reparto> {
        return this.http.post<Reparto>(`${this.baseUrl}/reabrir`, {}).pipe(
            tap((reparto) => {
                this.repartoHoy.set(reparto);
                this.resumen.set(null);
            }),
        );
    }

    abrirResumen() {
        this.verResumen.set(true);
    }

    cerrarResumen() {
        this.verResumen.set(false);
    }
}
