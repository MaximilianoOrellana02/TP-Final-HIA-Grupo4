import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environments";
import { RolUsuario } from "./auth.service";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

interface UsuarioNuevoInput {
    username: string;
    password: string;
    nombreCompleto: string;
    email: string;
    rol: RolUsuario;
}

interface UsuarioCreado {
    id: string;
    username: string;
    nombreCompleto: string;
    email: string;
}

@Injectable({
    providedIn: 'root'
})

export class UsuarioService {
    private apiUrl = `${environment.apiUrl}/usuarios`;
    private http = inject(HttpClient);

    crearUsuario(usuario: UsuarioNuevoInput): Observable<UsuarioCreado> {
        return this.http.post<UsuarioCreado>(`${this.apiUrl}/registro`, usuario);

    }
}