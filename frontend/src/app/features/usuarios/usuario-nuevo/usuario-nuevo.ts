import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UsuarioService } from '../../../core/services/usuario.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RolUsuario } from '../../../core/services/auth.service';

@Component({
  selector: 'app-usuario-nuevo',
  imports: [FormsModule, RouterLink],
  templateUrl: './usuario-nuevo.html',
  styleUrl: './usuario-nuevo.css',
})
export default class UsuarioNuevo {
  private usuarioService = inject(UsuarioService);
  private notificationService = inject(NotificationService);

  guardando = signal(false)

  exito = signal(false);
  verPassword = signal(false);

  form = {
    username: '',
    password: '',
    passwordConfirmar: '',
    nombreCompleto: '',
    email: '',
    rol: 'repartidor' as RolUsuario,
  };

  togglePassword() {
    this.verPassword.update((v) => !v);
  }

  guardar() {
    if (!this.form.username || !this.form.password || !this.form.nombreCompleto || !this.form.email) {
      this.notificationService.mostrar('Completá todos los campos');
      return;
    }

    if (this.form.password.length < 6) {
      this.notificationService.mostrar('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (this.form.password !== this.form.passwordConfirmar) {
      this.notificationService.mostrar('Las contraseñas no coinciden');
      return;
    }

    this.guardando.set(true);

    this.usuarioService
      .crearUsuario({
        username: this.form.username,
        password: this.form.password,
        nombreCompleto: this.form.nombreCompleto,
        email: this.form.email,
        rol: this.form.rol,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.exito.set(true);
        },
        error: (err) => {
          this.guardando.set(false);
          this.notificationService.mostrar(err.error?.error ?? 'No se pudo crear el usuario');
        },
      });
  }
}
