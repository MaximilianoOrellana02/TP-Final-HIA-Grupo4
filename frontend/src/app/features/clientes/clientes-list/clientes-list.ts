import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ClienteService } from '../../../core/services/cliente.service';
import { BarrioService } from '../../../core/services/barrio.service';
import { ActividadCliente, Cliente, ClienteDeudaVieja } from '../../../core/models/cliente.model';
import { Barrio, DIAS_SEMANA, DiaSemana } from '../../../core/models/barrio.model';
import { NotificationService } from '../../../core/services/notification.service';
import { calcularParadas, hoyEnArgentina, restaurantesIncluidosHoy } from '../../../shared/paradas-hoy.util';
import PagoModal from '../../../shared/pago-modal/pago-modal';

type Filtro = 'todos' | 'deuda' | 'ruta' | 'frecuentes';
type AccionPrincipal = 'entregar' | 'cobrar' | 'detalle';

// Minúsculas y sin acentos, para que "gomez" encuentre "Gómez".
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

@Component({
  selector: 'app-clientes-list',
  imports: [RouterLink, DecimalPipe, PagoModal],
  templateUrl: './clientes-list.html',
  styleUrl: './clientes-list.css',
})
export default class ClientesList implements OnInit {
  private clienteService = inject(ClienteService);
  private barrioService = inject(BarrioService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);

  dias = DIAS_SEMANA;

  clientes = signal<Cliente[]>([]);
  barrios = signal<Barrio[]>([]);
  private actividad = signal(new Map<string, ActividadCliente>());
  activosMes = signal<number | null>(null);
  deudaVieja = signal<ClienteDeudaVieja[]>([]);

  cargando = signal(true);
  error = signal<string | null>(null);
  viendoArchivados = signal(false);
  restaurandoId = signal<string | null>(null);
  limiteVisible = signal(10);

  busqueda = signal('');
  filtro = signal<Filtro>('todos');
  // Panel del ícono de filtros: lo que antes eran los chips de día, restaurantes y el aviso de deuda vieja.
  mostrarFiltros = signal(false);
  dia = signal<DiaSemana | ''>('');
  soloComerciales = signal(false);
  soloDeudaVieja = signal(false);
  filtrosAvanzadosActivos = computed(() => !!this.dia() || this.soloComerciales() || this.soloDeudaVieja());

  clienteACobrar = signal<Cliente | null>(null);

  // Misma ruta que Hoy: "Parada N" y "Hoy en ruta" coinciden en las dos pantallas.
  private paradas = computed(() => calcularParadas(this.clientes(), this.barrios(), restaurantesIncluidosHoy()));
  private numeroParada = computed(() => new Map(this.paradas().pendientes.map((c, i) => [c.id, i + 1])));
  private enRutaHoy = computed(() => new Set(this.paradas().deHoy.map((c) => c.id)));

  conteos = computed(() => {
    const clientes = this.clientes();
    return {
      todos: clientes.length,
      deuda: clientes.filter((c) => c.saldoActual > 0).length,
      ruta: clientes.filter((c) => this.enRutaHoy().has(c.id)).length,
      frecuentes: clientes.filter((c) => this.actividad().get(c.id)?.frecuente).length,
    };
  });
  saldoPendiente = computed(() =>
    this.clientes().reduce((total, c) => total + (c.saldoActual > 0 ? c.saldoActual : 0), 0),
  );

  clientesFiltrados = computed(() => {
    const texto = normalizar(this.busqueda());
    const coincideTexto = (c: Cliente) =>
      !texto ||
      [`${c.nombre} ${c.apellido}`, `${c.apellido} ${c.nombre}`, c.direccion, c.telefono, c.localidad].some(
        (dato) => dato && normalizar(dato).includes(texto),
      );
    if (this.viendoArchivados()) return this.clientes().filter(coincideTexto);

    const diasViejos = new Map(this.deudaVieja().map((d) => [d.id, d.diasSinPagar]));
    let lista = this.clientes().filter((c) => {
      if (!coincideTexto(c)) return false;
      switch (this.filtro()) {
        case 'deuda': if (c.saldoActual <= 0) return false; break;
        case 'ruta': if (!this.enRutaHoy().has(c.id)) return false; break;
        case 'frecuentes': if (!this.actividad().get(c.id)?.frecuente) return false; break;
      }
      if (this.dia() && !this.diasDelCliente(c).includes(this.dia() as DiaSemana)) return false;
      if (this.soloComerciales() && c.categoria !== 'restaurante') return false;
      if (this.soloDeudaVieja() && !diasViejos.has(c.id)) return false;
      return true;
    });
    if (this.soloDeudaVieja()) lista = [...lista].sort((a, b) => diasViejos.get(b.id)! - diasViejos.get(a.id)!);
    // En la ruta de hoy se ordena como en Hoy: primero las paradas pendientes, en su orden.
    if (this.filtro() === 'ruta') {
      const orden = this.numeroParada();
      lista = [...lista].sort((a, b) => (orden.get(a.id) ?? Infinity) - (orden.get(b.id) ?? Infinity));
    }
    return lista;
  });
  clientesMostrados = computed(() => this.clientesFiltrados().slice(0, this.limiteVisible()));
  cantidadRestante = computed(() => Math.max(0, this.clientesFiltrados().length - this.limiteVisible()));

  ngOnInit() {
    this.cargarClientes();
    this.barrioService.listar().subscribe({ next: (data) => this.barrios.set(data) });
    // Lo que sigue enriquece las tarjetas; si falla, la lista se muestra igual.
    this.clienteService.listarDeudaVieja().subscribe({ next: (data) => this.deudaVieja.set(data), error: () => {} });
    this.clienteService.actividad().subscribe({
      next: ({ activosMes, clientes }) => {
        this.activosMes.set(activosMes);
        this.actividad.set(new Map(clientes.map((a) => [a.clienteId, a])));
      },
      error: () => {},
    });
  }

  cargarClientes() {
    this.cargando.set(true);
    this.error.set(null);
    const listado = this.viendoArchivados() ? this.clienteService.listarDesactivados() : this.clienteService.listar();
    listado.subscribe({
      next: (data) => {
        this.clientes.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(this.viendoArchivados() ? 'No se pudieron cargar los clientes archivados' : 'No se pudieron cargar los clientes');
        this.cargando.set(false);
      },
    });
  }

  private reiniciarPaginado() {
    this.limiteVisible.set(10);
  }

  onBusqueda(texto: string) {
    this.busqueda.set(texto);
    this.reiniciarPaginado();
  }

  cambiarFiltro(filtro: Filtro) {
    this.filtro.set(filtro);
    this.reiniciarPaginado();
  }

  cambiarDia(dia: DiaSemana | '') {
    this.dia.set(dia);
    this.reiniciarPaginado();
  }

  toggleComerciales() {
    this.soloComerciales.update((v) => !v);
    this.reiniciarPaginado();
  }

  toggleDeudaVieja() {
    this.soloDeudaVieja.update((v) => !v);
    this.reiniciarPaginado();
  }

  limpiarFiltros() {
    this.dia.set('');
    this.soloComerciales.set(false);
    this.soloDeudaVieja.set(false);
    this.reiniciarPaginado();
  }

  toggleArchivados() {
    this.viendoArchivados.update((v) => !v);
    this.mostrarFiltros.set(false);
    this.reiniciarPaginado();
    this.cargarClientes();
  }

  verMas() {
    this.limiteVisible.update((v) => v + 15);
  }

  private diasDelCliente(c: Cliente): DiaSemana[] {
    return (this.barrios().find((b) => b.id === c.barrioId)?.diasVisita as DiaSemana[] | undefined) ?? [];
  }

  // ---------- Datos de cada tarjeta ----------

  iniciales(c: Cliente): string {
    return `${c.nombre.charAt(0)}${c.apellido.charAt(0)}`.toUpperCase();
  }

  parada(c: Cliente): number | null {
    return this.numeroParada().get(c.id) ?? null;
  }

  // Una sola etiqueta: Parada N (ruta de hoy) → Comercial → Al día.
  etiqueta(c: Cliente): { texto: string; tipo: 'parada' | 'comercial' | 'al-dia' } | null {
    const parada = this.parada(c);
    if (parada) return { texto: `Parada ${parada}`, tipo: 'parada' };
    if (c.categoria === 'restaurante') return { texto: 'Comercial', tipo: 'comercial' };
    if (c.saldoActual <= 0) return { texto: c.saldoActual < 0 ? 'A favor' : 'Al día', tipo: 'al-dia' };
    return null;
  }

  ultimaEntrega(c: Cliente): string {
    const fecha = this.actividad().get(c.id)?.ultimaEntrega;
    if (!fecha) return 'Sin entregas';
    const dia = new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const dias = Math.round((Date.parse(hoyEnArgentina()) - Date.parse(dia)) / 86_400_000);
    if (dias <= 0) return 'Última entrega: hoy';
    if (dias === 1) return 'Última entrega: ayer';
    return `Última entrega: hace ${dias} días`;
  }

  // Entregar si está en la ruta de hoy → Cobrar si debe → Detalle.
  accion(c: Cliente): AccionPrincipal {
    if (this.parada(c)) return 'entregar';
    if (c.saldoActual > 0) return 'cobrar';
    return 'detalle';
  }

  ejecutarAccion(event: Event, c: Cliente) {
    event.stopPropagation();
    switch (this.accion(c)) {
      case 'entregar':
        this.router.navigate(['/clientes', c.id, 'entrega']);
        break;
      case 'cobrar':
        this.clienteACobrar.set(c);
        break;
      default:
        this.irADetalle(c.id);
    }
  }

  onPagoRegistrado() {
    this.clienteACobrar.set(null);
    this.cargarClientes();
  }

  irADetalle(id: string) {
    this.router.navigate(['/clientes', id]);
  }

  detener(event: Event) {
    event.stopPropagation();
  }

  // ---------- Archivados ----------

  restaurarCliente(event: Event, cliente: Cliente) {
    event.stopPropagation();
    if (this.restaurandoId()) return;
    this.notificationService.confirmar(
      'Restaurar cliente',
      `¿Querés volver a activar a ${cliente.nombre} ${cliente.apellido}?`,
      () => this.confirmarRestauracion(cliente),
      'Restaurar',
      { advertencia: 'El cliente volverá a aparecer en los listados activos y podrá recibir entregas.' },
    );
  }

  private confirmarRestauracion(cliente: Cliente) {
    this.restaurandoId.set(cliente.id);
    this.clienteService.restaurarCliente(cliente.id).subscribe({
      next: () => {
        this.clientes.update((lista) => lista.filter((item) => item.id !== cliente.id));
        this.restaurandoId.set(null);
        this.notificationService.mostrar(`${cliente.nombre} ${cliente.apellido} fue restaurado correctamente.`, 'success');
      },
      error: (err) => {
        this.restaurandoId.set(null);
        this.notificationService.mostrar(err.error?.error ?? 'No se pudo restaurar el cliente.');
      },
    });
  }
}
