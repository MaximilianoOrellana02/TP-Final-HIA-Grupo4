import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ClienteService } from '../../../core/services/cliente.service';
import { BarrioService } from '../../../core/services/barrio.service';
import { ResumenHoy } from '../../../core/models/historial.model';
import { Cliente } from '../../../core/models/cliente.model';
import { HistorialService } from '../../../core/services/historial.service';
import { finalize, forkJoin } from 'rxjs';
import { Barrio } from '../../../core/models/barrio.model';
import { calcularParadas, guardarRestaurantesIncluidosHoy, restaurantesIncluidosHoy } from '../../../shared/paradas-hoy.util';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import RutaMapaModal from '../../../shared/ruta-mapa-modal/ruta-mapa-modal';
import { NotificationService } from '../../../core/services/notification.service';
import { RepartoService } from '../../../core/services/reparto.service';

// Minúsculas y sin acentos, para que "gomez" encuentre "Gómez".
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

@Component({
  selector: 'app-hoy-home',
  imports: [RouterLink, DecimalPipe, RutaMapaModal],
  templateUrl: './hoy-home.html',
  styleUrl: './hoy-home.css',
})
export default class HoyHome implements OnInit {
  private clienteService = inject(ClienteService);
  private barrioService = inject(BarrioService);
  private historialService = inject(HistorialService);
  private notificationService = inject(NotificationService);
  repartoService = inject(RepartoService);

  cargando = signal(true);
  error = signal<string | null>(null);
  guardandoVisitaId = signal<string | null>(null);
  resumen = signal<ResumenHoy | null>(null);
  paradasHoy = signal<Cliente[]>([]);
  paradasPendientes = signal<Cliente[]>([]);
  paradasRealizadas = signal<Cliente[]>([]);
  mostrarMapa = signal(false);
  incluirRestaurantes = signal(false);
  mostrarDetalleCobrado = signal(false);
  mostrarDetalleEntregados = signal(false);
  terminando = signal(false);

  // Buscador: filtra solo las listas; progreso y "Terminar reparto" siguen contando todas las paradas.
  busqueda = signal('');
  private termino = computed(() => normalizar(this.busqueda()));
  pendientesFiltradas = computed(() => this.paradasPendientes().filter((c) => this.coincide(c)));
  realizadasFiltradas = computed(() => this.paradasRealizadas().filter((c) => this.coincide(c)));

  private clientesCargados: Cliente[] = [];
  private barriosCargados: Barrio[] = [];

  fechaHoyTexto = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  private coincide(c: Cliente): boolean {
    const termino = this.termino();
    if (!termino) return true;
    const datos = [c.nombre, c.apellido, `${c.nombre} ${c.apellido}`, c.direccion, c.localidad];
    return datos.some((dato) => dato && normalizar(dato).includes(termino));
  }

  ngOnInit() {
    this.cargarEstadoRestaurantes();
    this.cargar();
    // Se vuelve a consultar al entrar: si la app quedó abierta de un día para otro, el reparto de ayer ya no vale.
    this.repartoService.cargarRepartoHoy().subscribe({ error: () => {} });
  }

  comenzarReparto() {
    this.repartoService.registrarComienzo().subscribe({
      error: (err) => this.notificationService.mostrar(err.error?.error ?? 'No se pudo comenzar el reparto'),
    });
  }

  // Se habilita cuando no quedan paradas pendientes; cierra el día y muestra el resumen.
  terminarReparto() {
    if (this.terminando() || this.paradasPendientes().length > 0) return;
    this.notificationService.confirmar(
      'Terminar reparto',
      'Se cierra el reparto de hoy y se muestra el resumen del día.',
      () => this.confirmarTerminar(),
      'Terminar',
    );
  }

  private confirmarTerminar() {
    this.terminando.set(true);
    this.repartoService
      .terminar()
      .pipe(finalize(() => this.terminando.set(false)))
      .subscribe({
        next: () => this.repartoService.abrirResumen(),
        error: (err) => this.notificationService.mostrar(err.error?.error ?? 'No se pudo terminar el reparto'),
      });
  }

  cargar() {
    this.cargando.set(true);

    forkJoin({
      clientes: this.clienteService.listar(),
      barrios: this.barrioService.listar(),
      resumen: this.historialService.resumenHoy(),
    }).subscribe({
      next: ({ clientes, barrios, resumen }) => {
        this.clientesCargados = clientes;
        this.barriosCargados = barrios;
        this.actualizarListado();
        this.resumen.set(resumen);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el resumen de hoy');
        this.cargando.set(false);
      },
    });
  }

  toggleRestaurantes() {
    const nuevoEstado = !this.incluirRestaurantes();
    this.incluirRestaurantes.set(nuevoEstado);
    this.guardarEstadoRestaurantes(nuevoEstado);
    this.actualizarListado();
  }

  marcarVisitado(cliente: Cliente) {
    if (this.guardandoVisitaId() !== null) return;

    this.notificationService.confirmar(
      `¿Marcar a ${cliente.nombre} ${cliente.apellido}?`,
      'Se quitará de las paradas pendientes sin registrar entregas ni cobros.',
      () => this.confirmarVisita(cliente),
      'Sí, marcar',
    );
  }

  private confirmarVisita(cliente: Cliente) {
    this.guardandoVisitaId.set(cliente.id);
    this.clienteService.marcarVisita(cliente.id, true)
      .pipe(finalize(() => this.guardandoVisitaId.set(null)))
      .subscribe({
        next: (actualizado) => {
          this.clientesCargados = this.clientesCargados.map((c) =>
            c.id === cliente.id ? { ...c, ultimaVisitaFecha: actualizado.ultimaVisitaFecha } : c
          );
          this.actualizarListado();
        },
        error: () => {
          this.notificationService.mostrar(
            `No se pudo marcar a ${cliente.nombre} ${cliente.apellido} como visitado. Intentá nuevamente.`
          );
        },
      });
  }

  // El cálculo de la ruta es compartido con Clientes, para que "Parada N" coincida en las dos pantallas.
  private actualizarListado() {
    const { deHoy, pendientes, realizadas } = calcularParadas(
      this.clientesCargados,
      this.barriosCargados,
      this.incluirRestaurantes(),
    );
    this.paradasHoy.set(deHoy);
    this.paradasPendientes.set(pendientes);
    this.paradasRealizadas.set(realizadas);
  }

  private cargarEstadoRestaurantes() {
    if (restaurantesIncluidosHoy()) this.incluirRestaurantes.set(true);
  }

  private guardarEstadoRestaurantes(activo: boolean) {
    guardarRestaurantesIncluidosHoy(activo);
  }

  visitadasHoy(): number {
    return this.paradasHoy().length - this.paradasPendientes().length;
  }

  progresoPorcentaje(): number {
    const total = this.paradasHoy().length;
    if (total === 0) return 0;
    return Math.round((this.visitadasHoy() / total) * 100);
  }

  toggleDetalleCobrado() {
    this.mostrarDetalleCobrado.update((abierto) => !abierto);
  }

  toggleDetalleEntregados() {
    this.mostrarDetalleEntregados.update((abierto) => !abierto);
  }

  productosEntregados() {
    return (this.resumen()?.productos ?? []).filter((producto) => producto.cantidad > 0);
  }

  abrirMapa() {
    this.mostrarMapa.set(true);
  }

  cerrarMapa() {
    this.mostrarMapa.set(false);
  }

  compartirRuta() {
    const texto = this.armarTextoRuta();

    if (navigator.share) {
      navigator.share({ title: 'Ruta de Hoy', text: texto }).catch(() => { });
      return;
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(() => {
        this.notificationService.mostrar(
          'Ruta copiada al portapapeles. Pegala donde quieras.',
          'success',
        );
      });
      return;
    }

    this.notificationService.mostrar(
      'Tu navegador no permite compartir ni copiar la ruta automáticamente.',
    );
  }

  private armarTextoRuta(): string {
    const lista = this.paradasPendientes();

    const lineas = lista.map((c, i) => {
      const direccion = c.direccion ? `\n📍 ${c.direccion}` : '';
      const telefono = c.telefono ? `\n📞 ${c.telefono}` : '';
      const deuda = c.saldoActual > 0 ? `\n💰 Debe $${c.saldoActual}` : '';
      return `${i + 1}. ${c.apellido}, ${c.nombre}${direccion}${telefono}${deuda}`;
    });

    return `🚚 Ruta de Hoy (${this.fechaHoyTexto})\n\n${lineas.join('\n\n')}\n\nTotal paradas pendientes: ${lista.length}`;
  }
}
