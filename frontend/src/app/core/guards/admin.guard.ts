import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Las pantallas de admin igual estan protegidas por el backend; esto evita mostrar una pantalla que va a fallar.
export const adminGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const usuario = authService.usuarioActual();

    if (usuario?.rol) {
        return usuario.rol === 'admin' ? true : router.parseUrl('/hoy');
    }

    // Sesion guardada sin rol (anterior a los roles): se consulta al backend antes de decidir.
    return authService.refrescarUsuario().pipe(
        map((actual) => (actual.rol === 'admin' ? true : router.parseUrl('/hoy'))),
        catchError(() => of(router.parseUrl('/hoy'))),
    );
};
