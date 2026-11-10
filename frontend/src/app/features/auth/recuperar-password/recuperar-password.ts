import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-recuperar-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './recuperar-password.html',
  styleUrl: './recuperar-password.css',
})
export default class RecuperarPassword {
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  email = '';
  enviando = signal(false)
  enviado = signal(false);

  enviar() {
    if (!this.email) {
      this.notificationService.mostrar('Ingresá tu email')
      return;
    }
    this.enviando.set(true);

    this.authService.solicitarRecuperacion(this.email).subscribe({
      next: () => {
        this.enviando.set(false);
        this.enviado.set(true);
      },
      error: () => {
        this.enviando.set(false);
        this.notificationService.mostrar('Ocurrió un error. Intentá de nuevo.');
      },
    });
  }
}
