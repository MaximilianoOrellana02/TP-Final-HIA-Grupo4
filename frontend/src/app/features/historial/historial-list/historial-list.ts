import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HistorialService } from '../../../core/services/historial.service';
import { Historial, ResumenHistorial } from '../../../core/models/historial.model';
import * as XLSX from 'xlsx';
import DashboardModal from '../../../shared/dashboard-modal/dashboard-modal';
import { NotificationService } from '../../../core/services/notification.service';
import { paginasVisibles } from '../../../shared/paginas-visibles.util';


type Filtro = 'hoy' | 'semana' | 'mes' | 'todos';


@Component({
  selector: 'app-historial-list',
  imports: [RouterLink, DashboardModal],
  templateUrl: './historial-list.html',
  styleUrl: './historial-list.css',
})
export default class HistorialList implements OnInit {
  private historialService = inject(HistorialService);
  private notificationService = inject(NotificationService);


  entregas = signal<Historial[]>([]);
  filtro = signal<Filtro>('hoy');
  page = signal(1);
  totalPages = signal(1);
  paginas = computed(() => paginasVisibles(this.page(), this.totalPages()));
  totalRegistros = signal(0);
  resumenPeriodo = signal<ResumenHistorial | null>(null);

  cargando = signal(true);
  error = signal<string | null>(null);

  mostrarDashboard = signal(false);
  fechaActualTexto = this.fechaCabecera();
  private cargaVersion = 0;

  private fechaCabecera(): string {
    const hoy = new Date();
    const mes = hoy.toLocaleDateString('es-AR', { month: 'long' });
    return `${hoy.getDate()} ${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${hoy.getFullYear()}`;
  }

  formatearMonto(valor: number): string {
    return Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  }

  formatearFecha(fecha: string): string {
    const valor = new Date(fecha);
    const dia = valor.getDate();
    const mes = valor.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    const hora = valor.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return `${dia} ${mes.charAt(0).toUpperCase()}${mes.slice(1)} · ${hora}`;
  }

  tituloEntregas(): string {
    return ({ hoy: 'Entregas de la jornada', semana: 'Entregas de los últimos 7 días', mes: 'Entregas del mes', todos: 'Todas las entregas' })[this.filtro()];
  }

  etiquetaEntregas(): string {
    return ({ hoy: 'Entregas hoy', semana: 'Entregas 7 días', mes: 'Entregas del mes', todos: 'Entregas totales' })[this.filtro()];
  }

  resumenProductos(entrega: Historial): string {
    const detalles = (entrega.detalles ?? []).filter((detalle) => Number(detalle.cantidadEntregada) > 0);
    if (detalles.length === 1) {
      const nombre = (detalles[0].producto?.nombre ?? 'producto').replace(/^bid[oó]n\s*/i, '');
      return `${detalles[0].cantidadEntregada}× ${nombre}`;
    }
    if (detalles.length > 1) return `${detalles.reduce((total, detalle) => total + Number(detalle.cantidadEntregada), 0)} unidades`;
    return '';
  }

  etiquetaPago(entrega: Historial): string {
    const monto = this.formatearMonto(entrega.montoPagado);
    if (entrega.montoPagado <= 0) return 'Pagó $0 (Pendiente)';
    const metodo = entrega.metodoPago === 'transferencia' ? 'Transf.' : entrega.metodoPago === 'mercadopago' ? 'Mercado Pago' : 'Pagó';
    return `${metodo} $${monto}${entrega.montoPagado < entrega.importeTotal ? ' (Parcial)' : ''}`;
  }

  abrirDashboard() {
    this.mostrarDashboard.set(true);
  }

  cerrarDashboard() {
    this.mostrarDashboard.set(false);
  }

  etiquetaFiltroActual(): string {
    const mapa: Record<string, string> = { hoy: 'Hoy', semana: 'Últimos 7 días', mes: 'Este mes', todos: 'Todos' };
    return mapa[this.filtro()] ?? 'Todos';
  }

  ngOnInit(): void {
    this.cargar(true)
  }

  cambiarFiltro(filtro: Filtro) {
    if (this.filtro() === filtro) return;
    this.filtro.set(filtro);
    this.cargar(true)
  }

  rangoFechas(): { desde?: string; hasta?: string } {
    const hoy = new Date();
    const inicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    switch (this.filtro()) {
      case 'hoy':
        return { desde: inicioDelDia.toISOString() };
      case 'semana': {
        const hace7dias = new Date(inicioDelDia);
        hace7dias.setDate(hace7dias.getDate() - 6);
        return { desde: hace7dias.toISOString() };
      }
      case 'mes': {
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        return { desde: inicioMes.toISOString() };
      }
      case 'todos':
        return {};
    }
  }

  cargar(reset: boolean, pagina = 1) {
    const version = ++this.cargaVersion;
    this.cargando.set(true);
    this.entregas.set([]);
    if (reset) {
      this.page.set(1);
      this.totalPages.set(1);
      this.entregas.set([]);
      this.totalRegistros.set(0);
      this.resumenPeriodo.set(null);
      this.historialService.resumen(this.rangoFechas()).subscribe({
        next: (resumen) => {
          if (this.cargaVersion === version) this.resumenPeriodo.set(resumen);
        },
        error: () => {
          if (this.cargaVersion === version) this.resumenPeriodo.set(null);
        },
      });
    }
    this.error.set(null);

    this.historialService.listar({ page: pagina, limit: 25, ...this.rangoFechas() }).subscribe({
      next: (resultado) => {
        if (this.cargaVersion !== version) return;
        this.entregas.set(resultado.data);
        this.page.set(pagina);
        this.totalPages.set(resultado.totalPages);
        this.totalRegistros.set(resultado.total);
        this.cargando.set(false);
      },
      error: () => {
        if (this.cargaVersion !== version) return;
        this.error.set('No se pudo cargar el historial');
        this.cargando.set(false);
      },
    });
  }

  cambiarPagina(pagina: number) {
    if (this.cargando() || (pagina === this.page() && !this.error()) || pagina < 1 || pagina > this.totalPages()) return;
    this.cargar(false, pagina);
  }



  exportando = signal(false);

  exportarExcel() {
    this.exportando.set(true);

    this.historialService.listar({ page: 1, limit: 5000, ...this.rangoFechas() }).subscribe({
      next: (resultado) => {
        const filas = resultado.data.map((h) => ({
          Fecha: new Date(h.fecha).toLocaleDateString('es-AR'),
          Hora: new Date(h.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          Cliente: `${h.cliente?.apellido ?? ''}, ${h.cliente?.nombre ?? ''}`,
          Repartidor: h.usuario?.nombreCompleto ?? '',
          'Saldo anterior': h.saldoAnterior,
          'Total entrega': h.importeTotal,
          'Monto pagado': h.montoPagado,
          'Saldo final': h.saldoFinal,
          Observación: h.observacion ?? '',
          'Saldo antes del ajuste': h.ajusteSaldo?.saldoEsperado ?? '',
          'Motivo del ajuste': h.ajusteSaldo?.motivo ?? '',
        }));

        const hoja = XLSX.utils.json_to_sheet(filas);

        hoja['!cols'] = [
          { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 18 }, { wch: 18 },
          { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 25 },
          { wch: 20 }, { wch: 35 },
        ];

        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, 'Historial');

        const nombreArchivo = `historial-${this.etiquetaFiltroArchivo()}-${this.fechaHoyArchivo()}.xlsx`;
        XLSX.writeFile(libro, nombreArchivo);

        this.exportando.set(false);
        this.notificationService.mostrar(`Archivo ${nombreArchivo} generado correctamente.`, 'success');
      },
      error: () => {
        this.error.set('No se pudo exportar el historial');
        this.exportando.set(false);
      },
    });
  }

  private etiquetaFiltroArchivo(): string {
    const mapa: Record<string, string> = {
      hoy: 'hoy',
      semana: '7dias',
      mes: 'mes',
      todos: 'todos',
    };
    return mapa[this.filtro()] ?? 'todos';
  }

  private fechaHoyArchivo(): string {
    return new Date().toISOString().split('T')[0]; // formato AAAA-MM-DD
  }
}
