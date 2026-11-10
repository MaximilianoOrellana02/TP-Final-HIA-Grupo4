import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environments';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Barrio } from '../models/barrio.model';

@Injectable({
  providedIn: 'root',
})
export class BarrioService {
  private baseUrl = `${environment.apiUrl}/barrios`;
  private http = inject(HttpClient);

  listar(): Observable<Barrio[]> {
    return this.http.get<Barrio[]>(this.baseUrl);
  }

  crear(nombre: string): Observable<Barrio> {
    return this.http.post<Barrio>(this.baseUrl, { nombre });
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  actualizar(id: string, cambios: { nombre?: string; diasVisita?: string[] }): Observable<Barrio> {
    return this.http.put<Barrio>(`${this.baseUrl}/${id}`, cambios);
  }
}
