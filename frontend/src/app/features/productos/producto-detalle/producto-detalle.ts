import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductoService } from '../../../core/services/producto.service';
import { precioVigente, Producto } from '../../../core/models/producto.model';
import { forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { PrecioParticularPipe } from '../../../shared/precio.pipe';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-producto-detalle',
  imports: [RouterLink, FormsModule, PrecioParticularPipe],
  templateUrl: './producto-detalle.html',
  styleUrl: './producto-detalle.css',
})
export default class ProductoDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productoService = inject(ProductoService);
  private notificationService = inject(NotificationService);
  authService = inject(AuthService);

  producto = signal<Producto | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);
  editando = signal(false);
  guardando = signal(false);

  precioParticular = 0;

  nombre = '';
  esRetornable = true;

  mostrarMovimiento = signal(false);
  tipoMovimiento = signal<'entrada' | 'salida'>('entrada');
  cantidadMovimiento = 0;
  motivoMovimiento = '';
  guardandoMovimiento = signal(false);
  errorMovimiento = signal<string | null>(null);

  stockMinimo = 0;


  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Producto no especificado');
      this.cargando.set(false);
      return;
    }
    this.cargarProducto(id);
  }

  cargarProducto(id: string) {
    this.cargando.set(true);
    this.productoService.listar().subscribe({
      next: (data) => {
        const encontrado = data.find((p) => p.id === id) ?? null;
        this.producto.set(encontrado);
        if (encontrado) this.sincronizarFormulario(encontrado);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set('No se pudo cargar el producto');
        this.cargando.set(false);
      }
    })
  }


  private sincronizarFormulario(producto: Producto) {
    this.precioParticular = precioVigente(producto, 'particular') ?? 0;
    this.nombre = producto.nombre;
    this.esRetornable = producto.esRetornable;
    this.stockMinimo = producto.stockMinimo;
  }

  activarEdicion() {
    this.editando.set(true);
  }

  cancelarEdicion() {
    const actual = this.producto();
    if (actual) this.sincronizarFormulario(actual);
    this.editando.set(false);
    this.error.set(null);
  }

  guardar() {
    const actual = this.producto();
    if (!actual) return;

    const llamadas = [];

    if (
      this.nombre !== actual.nombre ||
      this.esRetornable !== actual.esRetornable ||
      this.stockMinimo !== actual.stockMinimo
    ) {
      llamadas.push(
        this.productoService.actualizar(actual.id, {
          nombre: this.nombre,
          esRetornable: this.esRetornable,
          stockMinimo: this.stockMinimo,
        })
      );
    }

    const nuevoParticular = precioVigente(actual, 'particular') ?? 0;

    // Solo un admin puede cambiar precios (el backend responde 403 a los demás).
    if (this.authService.esAdmin() && this.precioParticular !== nuevoParticular) {
      llamadas.push(this.productoService.cambiarPrecio(actual.id, 'particular', this.precioParticular));
      llamadas.push(this.productoService.cambiarPrecio(actual.id, 'confianza', this.precioParticular));
    }

    if (llamadas.length === 0) {
      this.editando.set(false);
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    forkJoin(llamadas).subscribe({
      next: () => {
        this.cargarProducto(actual.id);
        this.editando.set(false);
        this.guardando.set(false);
        this.notificationService.mostrar('Producto actualizado correctamente.', 'success');
      },
      error: (err) => {
        const mensaje = err.error?.error ?? 'No se pudieron guardar los cambios';
        this.error.set(mensaje);
        this.guardando.set(false);
        this.notificationService.mostrar(mensaje);
      },
    });
  }

  desactivar() {
    const actual = this.producto();
    if (!actual) return;

    this.notificationService.confirmar(
      'Desactivar producto',
      `¿Querés desactivar "${actual.nombre}"?`,
      () => this.confirmarDesactivacion(actual),
      'Desactivar',
      { advertencia: 'El producto dejará de aparecer en las nuevas entregas.' },
    );
  }

  private confirmarDesactivacion(actual: Producto) {
    this.productoService.desactivar(actual.id).subscribe({
      next: () => {
        this.notificationService.mostrar(`Producto ${actual.nombre} desactivado.`, 'success');
        this.router.navigate(['/productos']);
      },
      error: (err) => this.error.set(err.error?.error ?? 'No se pudo desactivar el producto'),
    });
  }

  abrirMovimiento(tipo: 'entrada' | 'salida') {
    this.tipoMovimiento.set(tipo);
    this.cantidadMovimiento = 0;
    this.motivoMovimiento = '';
    this.errorMovimiento.set(null);
    this.mostrarMovimiento.set(true);
  }

  cerrarMovimiento() {
    this.mostrarMovimiento.set(false);
  }

  confirmarMovimiento() {
    const actual = this.producto();
    if (!actual) return;

    if (this.cantidadMovimiento <= 0) {
      this.errorMovimiento.set('La cantidad tiene que ser mayor a 0');
      return;
    }

    if (this.tipoMovimiento() === 'salida' && !this.motivoMovimiento.trim()) {
      this.errorMovimiento.set('El motivo es obligatorio para una salida');
      return;
    }

    this.guardandoMovimiento.set(true);
    this.errorMovimiento.set(null);

    this.productoService
      .crearMovimientoStock(actual.id, this.tipoMovimiento(), this.cantidadMovimiento, this.motivoMovimiento || undefined)
      .subscribe({
        next: () => {
          this.cargarProducto(actual.id);
          this.guardandoMovimiento.set(false);
          this.mostrarMovimiento.set(false);
          const tipo = this.tipoMovimiento() === 'entrada' ? 'Entrada' : 'Salida';
          this.notificationService.mostrar(
            `${tipo} de ${this.cantidadMovimiento} unidades de ${actual.nombre} registrada.`,
            'success',
          );
        },
        error: (err) => {
          this.errorMovimiento.set(err.error?.error ?? 'No se pudo registrar el movimiento');
          this.guardandoMovimiento.set(false);
        },
      });
  }

}
