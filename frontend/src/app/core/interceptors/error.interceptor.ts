import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const esRequestDeLogin = req.url.includes('/usuarios/login');

      if (error.status === 401 && !esRequestDeLogin) {
        // La sesión venció o el token ya no es válido: cerramos sesión y avisamos
        notificationService.mostrar('Tu sesión expiró. Volvé a iniciar sesión.', 'info');
        authService.logout();
      } else if (error.status === 0) {
        notificationService.mostrar('Sin conexión con el servidor. Verificá tu red.');
      } else if (error.status >= 500) {
        notificationService.mostrar('Ocurrió un error en el servidor. Intentá de nuevo.');
      }

      return throwError(() => error);
    })
  );
};