import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClienteService } from '../../../core/services/cliente.service';
import { CategoriaCliente, TipoCliente } from '../../../core/models/cliente.model';
import { BarrioService } from '../../../core/services/barrio.service';
import { Barrio } from '../../../core/models/barrio.model';
import MapaCliente from '../../../shared/mapa-cliente/mapa-cliente';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-cliente-nuevo',
  imports: [FormsModule, RouterLink, MapaCliente],
  templateUrl: './cliente-nuevo.html',
  styleUrl: './cliente-nuevo.css',
})
export default class ClienteNuevo implements OnInit {
  private clienteService = inject(ClienteService);
  private barrioService = inject(BarrioService);
  private notificationService = inject(NotificationService);

  private router = inject(Router);

  barrios = signal<Barrio[]>([]);
  guardando = signal(false);
  mapaAbierto = signal(true);
  obteniendoUbicacion = signal(false);

  toggleMapa() {
    this.mapaAbierto.update((v) => !v);
  }

  onPosicionCambiada(pos: { latitud: number; longitud: number }) {
    this.form.latitud = pos.latitud;
    this.form.longitud = pos.longitud;
  }

  async usarMiUbicacion() {
    if (this.obteniendoUbicacion()) return;

    this.obteniendoUbicacion.set(true);

    try {
      let latitud: number;
      let longitud: number;

      if (Capacitor.isNativePlatform()) {
        const posicion = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });
        latitud = posicion.coords.latitude;
        longitud = posicion.coords.longitude;
      } else {
        const posicion = await this.obtenerUbicacionDelNavegador();
        latitud = posicion.coords.latitude;
        longitud = posicion.coords.longitude;
      }

      this.form.latitud = latitud;
      this.form.longitud = longitud;
      this.mapaAbierto.set(true);
    } catch (error) {
      this.notificationService.mostrar(this.mensajeErrorUbicacion(error));
    } finally {
      this.obteniendoUbicacion.set(false);
    }
  }

  private obtenerUbicacionDelNavegador(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation || !window.isSecureContext) {
        reject(new Error('ubicacion-no-disponible'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
      });
    });
  }

  private mensajeErrorUbicacion(error: unknown): string {
    const codigo = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    const mensaje = error instanceof Error ? error.message.toLowerCase() : '';
    if (codigo === '1' || mensaje.includes('denied') || mensaje.includes('permiso')) {
      return 'No se pudo acceder a tu ubicación. Habilitá el permiso de ubicación e intentá nuevamente.';
    }
    return 'No pudimos obtener tu ubicación. Verificá que el GPS esté activo e intentá nuevamente.';
  }

  form = {
    nombre: '',
    apellido: '',
    direccion: '',
    telefono: '',
    localidad: '',
    notaRepartidor: '',
    referencia: '',
    barrioId: '',
    categoria: 'domicilio' as CategoriaCliente,
    tipoCliente: 'particular' as TipoCliente,
    latitud: null as number | null,
    longitud: null as number | null,
  };

  ngOnInit(): void {
    this.barrioService.listar().subscribe({
      next: (data) => this.barrios.set(data),
    });
  }

  guardar() {
    if (!this.form.nombre || !this.form.apellido) {
      this.notificationService.mostrar('Nombre y apellido son obligatorios');
      return;
    }

    const barrio = this.barrios().find((b) => b.id === this.form.barrioId)?.nombre || 'Sin asignar';

    this.notificationService.confirmar(
      `Crear cliente ${this.form.nombre} ${this.form.apellido}`,
      '',
      () => this.crearCliente(),
      'Crear cliente',
      {
        etiquetaSuperior: 'Nuevo registro',
        advertencia: this.form.barrioId
          ? undefined
          : 'Si no asignás un barrio, el cliente no aparecerá en el mapa de ruta.',
        detalles: [
          { etiqueta: 'Nombre', valor: `${this.form.nombre} ${this.form.apellido}` },
          { etiqueta: 'Dirección', valor: this.form.direccion || 'Sin registrar' },
          { etiqueta: 'Teléfono', valor: this.form.telefono || 'Sin registrar' },
          { etiqueta: 'Localidad', valor: this.form.localidad || 'Sin registrar' },
          {
            etiqueta: 'Tipo',
            valor: this.form.tipoCliente === 'confianza' ? 'De confianza' : 'Particular',
            tono: 'info',
          },
          { etiqueta: 'Barrio', valor: barrio, tono: this.form.barrioId ? undefined : 'warning' },
          {
            etiqueta: 'Categoría',
            valor: this.form.categoria === 'restaurante' ? 'Restaurante' : 'Domicilio',
          },
        ],
      },
    );
  }

  private crearCliente() {
    this.guardando.set(true);

    const payload = {
      ...this.form,
      barrioId: this.form.barrioId || undefined,
      latitud: this.form.latitud ?? undefined,
      longitud: this.form.longitud ?? undefined,
    };

    this.clienteService.crear(payload).subscribe({
      next: (cliente) => {
        this.notificationService.mostrar(
          `Cliente ${cliente.nombre} ${cliente.apellido} creado correctamente.`,
          'success',
        );
        this.router.navigate(['/clientes', cliente.id]);
      },
      error: (err) => {
        this.guardando.set(false);
        this.notificationService.mostrar(err.error?.error ?? 'No se pudo crear el cliente');
      },
    });
  }
}
