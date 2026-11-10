import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HistorialService } from '../../../core/services/historial.service';
import { cantidadPorCategoria, Historial } from '../../../core/models/historial.model';
import { NotificationService } from '../../../core/services/notification.service';

import * as XLSX from 'xlsx'

@Component({
  selector: 'app-cliente-historial',
  imports: [RouterLink, DatePipe],
  templateUrl: './cliente-historial.html',
  styleUrl: './cliente-historial.css',
})
export default class ClienteHistorial implements OnInit {
  private router = inject(ActivatedRoute);
  private historialService = inject(HistorialService);
  private notificationService = inject(NotificationService);

  clienteId = '';
  entregas = signal<Historial[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.clienteId = this.router.snapshot.paramMap.get('id') ?? '';
    if (!this.clienteId) {
      this.error.set('Cliente no especificado');
      this.cargando.set(false);
      return;
    }

    this.historialService.porCliente(this.clienteId).subscribe({
      next: (data) => {
        this.entregas.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el historial');
        this.cargando.set(false);
      },
    });
  }

  get productosUnicos(): string[] {
    const nombres = new Set<string>();
    for (const h of this.entregas()) {
      for (const d of h.detalles ?? []) {
        if (d.producto?.nombre) nombres.add(d.producto.nombre);
      }
    }
    return Array.from(nombres).sort();
  }

  cantidadDeProducto(h: Historial, nombreProducto: string): number {
    return (h.detalles ?? [])
      .filter((d) => d.producto?.nombre === nombreProducto)
      .reduce((acc, d) => acc + d.cantidadEntregada, 0);
  }

  claseColumna(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('agua')) return 'col-agua';
    if (n.includes('soda')) return 'col-soda';
    return '';
  }

  soda(h: Historial): number {
    return cantidadPorCategoria(h, 'soda');
  }

  agua(h: Historial): number {
    return cantidadPorCategoria(h, 'agua');
  }

  exportarExcel() {
    const productos = this.productosUnicos;

    const filas = this.entregas().map((h) => {
      const fila: Record<string, any> = {
        Fecha: new Date(h.fecha).toLocaleDateString('es-AR'),
        Hora: new Date(h.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      };

      for (const nombre of productos) {
        fila[nombre] = this.cantidadDeProducto(h, nombre);
      }

      fila['Saldo anterior'] = h.saldoAnterior;
      fila['Total entrega'] = h.importeTotal;
      fila['Monto pagado'] = h.montoPagado;
      const metodoMap: Record<string, string> = {
        efectivo: 'Efectivo',
        transferencia: 'Transferencia',
        mercadopago: 'Mercado Pago',
      };
      fila['Método de pago'] = metodoMap[h.metodoPago] ?? 'Efectivo';
      fila['Saldo final'] = h.saldoFinal;
      fila['Observación'] = h.observacion ?? '';

      return fila;
    });

    const hoja = XLSX.utils.json_to_sheet(filas);

    hoja['!cols'] = [
      { wch: 12 }, { wch: 8 },
      ...productos.map(() => ({ wch: 12 })),
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 25 },
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Historial');

    const fechaArchivo = new Date().toISOString().split('T')[0];
    const nombreArchivo = `historial-cliente-${fechaArchivo}.xlsx`;
    XLSX.writeFile(libro, nombreArchivo);
    this.notificationService.mostrar(`Archivo ${nombreArchivo} generado correctamente.`, 'success');
  }
}
