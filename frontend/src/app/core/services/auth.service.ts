import { Injectable, signal, inject, PLATFORM_ID, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environments';

export type RolUsuario = 'admin' | 'repartidor';

export interface UsuarioSesion {
  id: string;
  username: string;
  nombreCompleto: string;
  email?: string;
  // Las sesiones guardadas antes de que existieran los roles no lo tienen hasta refrescar con /me.
  rol?: RolUsuario;
}

interface LoginResponse {
  token: string;
  usuario: UsuarioSesion;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private esNavegador = isPlatformBrowser(this.platformId);

  usuarioActual = signal<UsuarioSesion | null>(null);
  // Solo oculta opciones en la interfaz: el backend es quien hace cumplir los permisos.
  esAdmin = computed(() => this.usuarioActual()?.rol === 'admin');

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    if (this.esNavegador) {
      const guardado = localStorage.getItem('usuario');
      if (guardado) {
        this.usuarioActual.set(JSON.parse(guardado));
      }
    }
  }

  login(username: string, password: string) {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/usuarios/login`, {
      username,
      password,
    });
  }

  guardarSesion(respuesta: LoginResponse) {
    if (this.esNavegador) {
      localStorage.setItem('token', respuesta.token);
    }
    this.guardarUsuario(respuesta.usuario);
  }

  // Trae los datos actuales del usuario (por ejemplo, si un admin le cambio el rol).
  refrescarUsuario(): Observable<UsuarioSesion> {
    return this.http
      .get<UsuarioSesion>(`${environment.apiUrl}/usuarios/me`)
      .pipe(tap((usuario) => this.guardarUsuario(usuario)));
  }

  private guardarUsuario(usuario: UsuarioSesion) {
    if (this.esNavegador) {
      localStorage.setItem('usuario', JSON.stringify(usuario));
    }
    this.usuarioActual.set(usuario);
  }

  logout() {
    if (this.esNavegador) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }
    this.usuarioActual.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.esNavegador ? localStorage.getItem('token') : null;
  }

  estaLogueado(): boolean {
    return !!this.getToken();
  }

  cambiarPassword(passwordActual: string, passwordNueva: string) {
    return this.http.put<{ mensaje: string }>(`${environment.apiUrl}/usuarios/password`, {
      passwordActual,
      passwordNueva,
    });
  }

  solicitarRecuperacion(email: string) {
    return this.http.post<{ mensage: string }>(`${environment.apiUrl}/usuarios/recuperar`, { email })
  }

  restablecerPassword(token: string, passwordNueva: string) {
    return this.http.post<{ mensaje: string }>(`${environment.apiUrl}/usuarios/restablecer`, {
      token,
      passwordNueva,
    });
  }
}
