import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export default class Login {
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  username: string = ''
  password: string = ''

  cargando = signal(false)
  mostrarPassword = signal(false);


  togglePassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }


  onSubmit(): void {
    if (!this.username || !this.password) {
      this.notificationService.mostrar('Completá usuario y contraseña')
      return;
    }

    this.cargando.set(true);

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        this.authService.guardarSesion(response);
        this.router.navigate(['./clientes'])
      },
      error: (err) => {
        this.cargando.set(false);
        this.notificationService.mostrar(err.error?.error ?? 'Error al iniciar sesión');
      },
    })
  }
}
