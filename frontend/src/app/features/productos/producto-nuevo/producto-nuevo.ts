import { Component, inject, signal } from '@angular/core';
import { ProductoService } from '../../../core/services/producto.service';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-producto-nuevo',
  imports: [FormsModule, RouterLink],
  templateUrl: './producto-nuevo.html',
  styleUrl: './producto-nuevo.css',
})
export default class ProductoNuevo {
  private productoService = inject(ProductoService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);

  guardando = signal(false);
  error = signal<string | null>(null);

  form = {
    nombre: '',
    esRetornable: true,
    precioParticular: 0,
    precioConfianza: 0,
  };

  guardar() {
    if (!this.form.nombre) {
      this.error.set('El nombre es obligatorio');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    const payload = {
      ...this.form,
      precioConfianza: this.form.precioParticular,
    };

    this.productoService.crear(payload).subscribe({
      next: (producto) => {
        this.notificationService.mostrar(
          `Producto ${producto.nombre} creado correctamente.`,
          'success',
        );
        this.router.navigate(['/productos', producto.id]);
      },
      error: (err) => {
        const mensaje = err.error?.error ?? 'No se pudo crear el producto';
        this.guardando.set(false);
        this.error.set(mensaje);
        this.notificationService.mostrar(mensaje);
      },
    });
  }
}
