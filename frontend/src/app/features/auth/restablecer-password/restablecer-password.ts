import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-restablecer-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './restablecer-password.html',
  styleUrl: './restablecer-password.css',
})
export default class RestablecerPassword implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  token = '';
  passwordNueva = '';
  passwordConfirmar = '';
  guardando = signal(false);
  exito = signal(false);

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.notificationService.mostrar('Link inválido. Solicitá uno nuevo.');
    }
  }

  guardar() {
    if (!this.passwordNueva || this.passwordNueva.length < 6) {
      this.notificationService.mostrar('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (this.passwordNueva !== this.passwordConfirmar) {
      this.notificationService.mostrar('Las contraseñas no coinciden');
      return;
    }

    this.guardando.set(true);

    this.authService.restablecerPassword(this.token, this.passwordNueva).subscribe({
      next: () => {
        this.guardando.set(false);
        this.exito.set(true);
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.guardando.set(false);
        this.notificationService.mostrar(err.error?.error ?? 'No se pudo restablecer la contraseña');
      },
    });
  }
}
