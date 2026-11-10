import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ClienteService } from '../../../core/services/cliente.service';
import { CategoriaCliente, Cliente, TipoCliente } from '../../../core/models/cliente.model';
import { DecimalPipe } from '@angular/common';
import { Barrio, DIAS_SEMANA } from '../../../core/models/barrio.model';
import { BarrioService } from '../../../core/services/barrio.service';
import MapaCliente from '../../../shared/mapa-cliente/mapa-cliente';
import { armarLinkWhatsapp } from '../../../shared/whatsapp.util';
import PagoModal from '../../../shared/pago-modal/pago-modal';
import { HistorialService } from '../../../core/services/historial.service';
import { Historial } from '../../../core/models/historial.model';
import { NotificationService } from '../../../core/services/notification.service';

export type EstadoMovimiento = 'saldado' | 'parcial' | 'fiado' | 'pago';

export interface MovimientoItem {
  id: string;
  fechaTexto: string;
  titulo: string;
  subtitulo: string;
  monto: number;
  estado: EstadoMovimiento;
}

const ETIQUETA_ESTADO: Record<EstadoMovimiento, string> = {
  saldado: 'Saldado',
  parcial: 'Parcial',
  fiado: 'Fiado',
  pago: 'Pago recibido',
};

const COBRO_POR_METODO: Record<string, string> = {
  efectivo: 'Cobrado en efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "lunes", "lunes y jueves", "lunes, jueves y domingo".
function unirConY(partes: string[]): string {
  return partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

@Component({
  selector: 'app-cliente-detalle',
  imports: [FormsModule, RouterLink, DecimalPipe, MapaCliente, PagoModal],
  templateUrl: './cliente-detalle.html',
  styleUrl: './cliente-detalle.css',
})
export default class ClienteDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private clienteService = inject(ClienteService);
  private barrioService = inject(BarrioService);
  private historialService = inject(HistorialService);
  private notificationService = inject(NotificationService);

  cliente = signal<Cliente | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);
  editando = signal(false);
  guardando = signal(false);
  desactivando = signal(false);
  barrios = signal<Barrio[]>([]);
  movimientos = signal<MovimientoItem[]>([]);
  totalMovimientos = signal(0);
  movimientosCargando = signal(false);
  envases = signal<{ nombre: string; cantidad: number }[]>([]);
  // Activo = recibió alguna entrega en los últimos 30 días. null mientras no se sabe.
  activo = signal<boolean | null>(null);
  etiquetaEstado = ETIQUETA_ESTADO;

  mostrarPago = signal(false);

  abrirPago() {
    this.mostrarPago.set(true);
  }

  cerrarPago() {
    this.mostrarPago.set(false);
  }

  onPagoRegistrado() {
    const actual = this.cliente();
    if (actual) {
      this.cargarCliente(actual.id);
      this.cargarMovimientos(actual.id);
    }
    this.mostrarPago.set(false);
  }

  ajustandoUbicacion = signal(false);
  nuevaUbicacion = signal<{ latitud: number; longitud: number } | null>(null);

  mapaEdicionAbierto = signal(true);

  toggleMapaEdicion() {
    this.mapaEdicionAbierto.update((v) => !v);
  }

  onPosicionEditCambiada(pos: { latitud: number; longitud: number }) {
    this.form.latitud = pos.latitud;
    this.form.longitud = pos.longitud;
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

  ngOnInit() {
    this.barrioService.listar().subscribe({
      next: (data) => this.barrios.set(data),
    });
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Cliente no especificado');
      this.cargando.set(false);
      return;
    }
    this.cargarCliente(id);
    this.cargarMovimientos(id);
    this.cargarEnvases(id);
    this.clienteService.actividad().subscribe({
      next: ({ clientes }) => this.activo.set((clientes.find((a) => a.clienteId === id)?.entregasUltimos30 ?? 0) > 0),
      error: () => {},
    });
  }

  private cargarEnvases(id: string) {
    this.clienteService.obtenerSaldoEnvases(id).subscribe({
      next: (saldos) =>
        this.envases.set(
          saldos.filter((s) => s.cantidad > 0).map((s) => ({ nombre: s.producto?.nombre ?? 'Envases', cantidad: s.cantidad })),
        ),
      error: () => {},
    });
  }

  cargarCliente(id: string) {
    this.cargando.set(true);
    this.clienteService.obtenerCliente(id).subscribe({
      next: (data) => {
        this.cliente.set(data);
        this.sincronizarFormulario(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el cliente');
        this.cargando.set(false);
      },
    });
  }

  cargarMovimientos(id: string) {
    this.movimientosCargando.set(true);
    this.historialService.porCliente(id).subscribe({
      next: (data: Historial[]) => {
        this.totalMovimientos.set(data.length);
        this.movimientos.set(data.slice(0, 3).map((h) => this.aMovimiento(h)));
        this.movimientosCargando.set(false);
      },
      error: () => {
        this.movimientosCargando.set(false);
      },
    });
  }

  // "Entregado 2 Bidón 20 L" · "11 octubre · Cobrado en efectivo" · estado según lo que se pagó de esa entrega.
  private aMovimiento(h: Historial): MovimientoItem {
    const fecha = new Date(h.fecha);
    const [, mes, dia] = fecha.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).split('-').map(Number);
    const fechaTexto = `${dia} ${MESES[mes - 1] ?? ''}`;
    const importe = Number(h.importeTotal);
    const pagado = Number(h.montoPagado);
    const entregados = (h.detalles ?? []).filter((d) => Number(d.cantidadEntregada) > 0);
    const devueltos = (h.detalles ?? []).reduce((acc, d) => acc + (Number(d.cantidadEnvaseDevuelto) || 0), 0);
    const cobro = pagado > 0 ? COBRO_POR_METODO[h.metodoPago] ?? 'Cobrado' : 'Sin cobro';

    let titulo: string;
    let estado: EstadoMovimiento;
    let monto: number;
    if (entregados.length > 0 || importe > 0) {
      titulo = 'Entregado ' + entregados.map((d) => `${d.cantidadEntregada} ${d.producto?.nombre ?? ''}`.trim()).join(' + ');
      estado = pagado >= importe ? 'saldado' : pagado > 0 ? 'parcial' : 'fiado';
      monto = importe;
    } else if (devueltos > 0) {
      titulo = `Devolvió ${devueltos} envase${devueltos === 1 ? '' : 's'}`;
      estado = pagado > 0 ? 'pago' : 'saldado';
      monto = pagado;
    } else {
      titulo = 'Pago recibido';
      estado = 'pago';
      monto = pagado;
    }

    let subtitulo = `${fechaTexto} · ${cobro}`;
    if (h.ajusteSaldo) subtitulo += ' · Ajuste de saldo';
    return { id: h.id, fechaTexto, titulo, subtitulo, monto, estado };
  }

  iniciales(c: Cliente): string {
    return `${c.nombre.charAt(0)}${c.apellido.charAt(0)}`.toUpperCase();
  }

  // Abre Google Maps con la ruta hasta el cliente: por coordenadas si las tiene, si no por dirección.
  navegarUrl(c: Cliente): string | null {
    if (c.latitud != null && c.longitud != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${c.latitud},${c.longitud}`;
    }
    const direccion = [c.direccion, c.barrio?.nombre, c.localidad || 'San Salvador de Jujuy'].filter(Boolean).join(', ');
    return c.direccion ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(direccion)}` : null;
  }

  private sincronizarFormulario(cliente: Cliente) {
    this.form = {
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      direccion: cliente.direccion ?? '',
      telefono: cliente.telefono ?? '',
      localidad: cliente.localidad ?? '',
      notaRepartidor: cliente.notaRepartidor ?? '',
      referencia: cliente.referencia ?? '',
      barrioId: cliente.barrioId ?? '',
      categoria: cliente.categoria,
      tipoCliente: cliente.tipoCliente,
      latitud: cliente.latitud,
      longitud: cliente.longitud,
    };
  }

  activarEdicion() {
    this.editando.set(true);
  }

  cancelarEdicion() {
    const actual = this.cliente();
    if (actual) this.sincronizarFormulario(actual); // descarta cambios sin guardar
    this.editando.set(false);
  }

  guardar() {
    const actual = this.cliente();
    if (!actual) return;

    if (!this.form.nombre || !this.form.apellido) {
      this.notificationService.mostrar('Nombre y apellido son obligatorios');
      return;
    }

    this.guardando.set(true);

    const payload = {
      ...this.form,
      barrioId: this.form.barrioId || undefined,
      latitud: this.form.latitud ?? undefined,
      longitud: this.form.longitud ?? undefined,
    };

    this.clienteService.actualizar(actual.id, payload).subscribe({
      next: (data) => {
        this.cliente.set(data);
        this.sincronizarFormulario(data);
        this.editando.set(false);
        this.guardando.set(false);
        this.notificationService.mostrar('Datos del cliente actualizados correctamente.', 'success');
      },
      error: (err) => {
        this.notificationService.mostrar(err.error?.error ?? 'No se pudieron guardar los cambios');
        this.guardando.set(false);
      },
    });
  }

  activarAjusteUbicacion() {
    this.ajustandoUbicacion.set(true);
    this.nuevaUbicacion.set(null);
  }
  cancelarAjusteUbicacion() {
    this.ajustandoUbicacion.set(false);
    this.nuevaUbicacion.set(null);
  }

  onPosicionCambiada(pos: { latitud: number; longitud: number }) {
    this.nuevaUbicacion.set(pos);
  }

  guardarUbicacion() {
    const actual = this.cliente();
    const pos = this.nuevaUbicacion();
    if (!actual || !pos) return;

    this.clienteService.ajustarUbicacion(actual.id, pos.latitud, pos.longitud).subscribe({
      next: (data) => {
        this.cliente.set(data);
        this.ajustandoUbicacion.set(false);
        this.nuevaUbicacion.set(null);
        this.notificationService.mostrar('Ubicación del cliente guardada correctamente.', 'success');
      },
      error: (err) => this.notificationService.mostrar(err.error?.error ?? 'No se pudo guardar la ubicación'),
    });
  }

  desactivar() {
    const actual = this.cliente();
    if (!actual || this.desactivando()) return;

    this.notificationService.confirmar(
      'Desactivar cliente',
      `¿Querés desactivar a ${actual.nombre} ${actual.apellido}?`,
      () => this.confirmarDesactivacion(actual),
      'Desactivar',
      {
        advertencia: 'El cliente dejará de aparecer en listados y rutas. Los envases pendientes seguirán registrados; el saldo sí debe resolverse antes.',
      },
    );
  }

  private confirmarDesactivacion(cliente: Cliente) {
    this.desactivando.set(true);

    this.clienteService.eliminar(cliente.id).subscribe({
      next: () => {
        this.notificationService.mostrar(
          `Cliente ${cliente.nombre} ${cliente.apellido} desactivado correctamente.`,
          'success',
        );
        this.router.navigate(['/clientes']);
      },
      error: (err) => {
        this.desactivando.set(false);
        this.notificationService.mostrar(
          err.error?.error ?? 'No se pudo desactivar el cliente.',
        );
      },
    });
  }

  abrirWhatsapp(cliente: Cliente) {
    if (!cliente.telefono) return;
    const link = armarLinkWhatsapp(cliente.telefono, '');
    window.open(link, '_blank');
  }

  enviarRecordatorioWhatsapp(cliente: Cliente) {
    const mensaje = `Hola ${cliente.nombre}, te recordamos que tenés un saldo pendiente de $${cliente.saldoActual} con nostros. ¡Gracias!`
    const link = armarLinkWhatsapp(cliente.telefono ?? '', mensaje);
    window.open(link, '_blank')
  }

  get diasRepartoTexto(): string {
    const cliente = this.cliente();
    if (!cliente?.barrio) return "";

    const barrio = this.barrios().find((b) => b.id === cliente.barrioId);

    if (!barrio || barrio.diasVisita.length === 0) return '';

    const etiquetas = barrio.diasVisita.map((dia) => DIAS_SEMANA.find((d) => d.valor === dia)?.etiqueta ?? dia);
    return unirConY(etiquetas);

  }
}
