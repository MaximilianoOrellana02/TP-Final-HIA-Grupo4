import { Component, inject, OnInit, output, signal } from '@angular/core';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../core/services/notification.service';
import { BarrioService } from '../../core/services/barrio.service';
import { RepartoService } from '../../core/services/reparto.service';

type Vista = 'menu' | 'password';

@Component({
  selector: 'app-settings-modal',
  imports: [FormsModule, RouterLink],
  templateUrl: './settings-modal.html',
  styleUrl: './settings-modal.css',
})
export default class SettingsModal implements OnInit {
  themeService = inject(ThemeService);
  authService = inject(AuthService);
  repartoService = inject(RepartoService);
  private barrioService = inject(BarrioService);
  private notificationService = inject(NotificationService);

  totalBarrios = signal<number | null>(null);
  enLinea = signal(typeof navigator === 'undefined' || navigator.onLine);

  cerrar = output<void>();
  vista = signal<Vista>('menu');

  passwordActual = '';
  passwordNueva = '';
  passwordConfirmar = '';
  guardando = signal(false);
  error = signal<string | null>(null);
  exito = signal(false);
  verPassword = signal(false);

  ngOnInit() {
    this.barrioService.listar().subscribe({
      next: (barrios) => this.totalBarrios.set(barrios.length),
      error: () => this.totalBarrios.set(null),
    });
  }

  inicialesUsuario(): string {
    const nombre = this.authService.usuarioActual()?.nombreCompleto.trim() ?? '';
    return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte.charAt(0)).join('').toUpperCase() || 'US';
  }

  toggleTheme() {
    this.themeService.toggle();
  }

  logout() {
    this.notificationService.confirmar(
      'Cerrar sesión',
      '¿Querés cerrar tu sesión actual?',
      () => this.confirmarLogout(),
      'Cerrar sesión',
    );
  }

  private confirmarLogout() {
    this.authService.logout();
    this.cerrar.emit();
  }

  irAPassword() {
    this.vista.set('password');
    this.error.set(null);
    this.exito.set(false);
    this.verPassword.set(false);
    this.passwordActual = '';
    this.passwordNueva = '';
    this.passwordConfirmar = '';
  }

  togglePassword() {
    this.verPassword.update((v) => !v);
  }

  volverAlMenu() {
    this.vista.set('menu');
  }

  guardarPassword() {
    if (!this.passwordActual || !this.passwordNueva || !this.passwordConfirmar) {
      this.error.set('Completá todos los campos');
      return;
    }

    if (this.passwordNueva.length < 6) {
      this.error.set('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (this.passwordNueva !== this.passwordConfirmar) {
      this.error.set('Las contraseñas nuevas no coinciden');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    this.authService.cambiarPassword(this.passwordActual, this.passwordNueva).subscribe({
      next: () => {
        this.guardando.set(false);
        this.exito.set(true);
        this.passwordActual = '';
        this.passwordNueva = '';
        this.passwordConfirmar = '';
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(err.error?.error ?? 'No se pudo cambiar la contraseña');
      },
    });
  }
}
