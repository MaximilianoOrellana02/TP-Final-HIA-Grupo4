import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ProductoService } from '../../../core/services/producto.service';
import { MovimientoStock } from '../../../core/models/producto.model';
import { NotificationService } from '../../../core/services/notification.service';

type FiltroTipo = 'todos' | 'entrada' | 'salida';

const MESES = [
  { valor: 1, etiqueta: 'Enero' }, { valor: 2, etiqueta: 'Febrero' }, { valor: 3, etiqueta: 'Marzo' },
  { valor: 4, etiqueta: 'Abril' }, { valor: 5, etiqueta: 'Mayo' }, { valor: 6, etiqueta: 'Junio' },
  { valor: 7, etiqueta: 'Julio' }, { valor: 8, etiqueta: 'Agosto' }, { valor: 9, etiqueta: 'Septiembre' },
  { valor: 10, etiqueta: 'Octubre' }, { valor: 11, etiqueta: 'Noviembre' }, { valor: 12, etiqueta: 'Diciembre' },
];

@Component({
  selector: 'app-movimientos-stock-list',
  imports: [RouterLink, FormsModule],
  templateUrl: './movimientos-stock-list.html',
  styleUrl: './movimientos-stock-list.css',
})
export default class MovimientosStockList implements OnInit {
  private productoService = inject(ProductoService);
  private notificationService = inject(NotificationService);

  movimientos = signal<MovimientoStock[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);
  filtro = signal<FiltroTipo>('todos');
  exportando = signal(false);
  private cargaVersion = 0;

  formatearFecha(fecha: string): string {
    const valor = new Date(fecha);
    const mes = valor.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    const hora = valor.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return `${valor.getDate()} ${mes.charAt(0).toUpperCase()}${mes.slice(1)}, ${hora}`;
  }

  meses = MESES;
  anios: number[];

  verTodos = signal(false);
  mesSeleccionado: number;
  anioSeleccionado: number;

  constructor() {
    const hoy = new Date();
    this.mesSeleccionado = hoy.getMonth() + 1;
    this.anioSeleccionado = hoy.getFullYear();

    // Últimos 5 años (incluyendo el actual) — suficiente
    this.anios = Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - i);
  }

  ngOnInit() {
    this.cargar();
  }

  private rangoFechas(): { desde?: string; hasta?: string } {
    if (this.verTodos()) return {};

    const inicio = new Date(this.anioSeleccionado, this.mesSeleccionado - 1, 1);
    const fin = new Date(this.anioSeleccionado, this.mesSeleccionado, 0, 23, 59, 59);
    return { desde: inicio.toISOString(), hasta: fin.toISOString() };
  }

  cargar() {
    const version = ++this.cargaVersion;
    this.cargando.set(true);
    this.error.set(null);
    this.movimientos.set([]);
    const filtroVal = this.filtro();
    const tipo = filtroVal === 'todos' ? undefined : filtroVal;

    this.productoService.listarMovimientosStock({ tipo, ...this.rangoFechas() }).subscribe({
      next: (data) => {
        if (this.cargaVersion !== version) return;
        this.movimientos.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        if (this.cargaVersion !== version) return;
        this.error.set(err.error?.error ?? 'No se pudieron cargar los movimientos');
        this.cargando.set(false);
      },
    });
  }

  cambiarFiltro(filtro: FiltroTipo) {
    this.filtro.set(filtro);
    this.cargar();
  }

  cambiarMesAnio() {
    this.verTodos.set(false);
    this.cargar();
  }

  toggleVerTodos() {
    this.verTodos.update((v) => !v);
    this.cargar();
  }

  etiquetaPeriodo(): string {
    if (this.verTodos()) return 'todos';
    const mes = this.meses.find((m) => m.valor === this.mesSeleccionado)?.etiqueta ?? '';
    return `${mes}-${this.anioSeleccionado}`;
  }

  exportarExcel() {
    this.exportando.set(true);

    const filas = this.movimientos().map((m) => ({
      Fecha: new Date(m.fecha).toLocaleDateString('es-AR'),
      Hora: new Date(m.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      Producto: m.producto?.nombre ?? '',
      Tipo: m.tipo === 'entrada' ? 'Entrada' : 'Salida',
      Cantidad: m.cantidad,
      Motivo: m.motivo ?? '',
      Usuario: m.usuario?.nombreCompleto ?? '',
    }));

    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja['!cols'] = [
      { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 20 },
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Movimientos');

    const nombreArchivo = `movimientos-stock-${this.etiquetaPeriodo()}.xlsx`;
    XLSX.writeFile(libro, nombreArchivo);
    this.exportando.set(false);
    this.notificationService.mostrar(`Archivo ${nombreArchivo} generado correctamente.`, 'success');
  }
}
