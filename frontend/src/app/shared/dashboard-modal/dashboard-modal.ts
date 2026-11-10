import { Component, input, output, OnInit, inject, signal } from '@angular/core';
import { HistorialService } from '../../core/services/historial.service';
import { ResumenHistorial } from '../../core/models/historial.model';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard-modal',
  imports: [DecimalPipe],
  templateUrl: './dashboard-modal.html',
  styleUrl: './dashboard-modal.css',
})
export default class DashboardModal implements OnInit {
  private historialService = inject(HistorialService);

  desde = input<string>();
  hasta = input<string>();
  etiquetaPeriodo = input<string>('');
  esMesActual = input<boolean>(false);

  cerrar = output<void>();

  resumen = signal<ResumenHistorial | null>(null);
  resumenAnterior = signal<ResumenHistorial | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    const peticiones: any = {
      actual: this.historialService.resumen({ desde: this.desde(), hasta: this.hasta() }),
    };

    if (this.esMesActual()) {
      const { desde, hasta } = this.rangoMesAnterior();
      peticiones.anterior = this.historialService.resumen({ desde, hasta });
    }

    forkJoin(peticiones).subscribe({
      next: (resultado: any) => {
        this.resumen.set(resultado.actual);
        if (resultado.anterior) this.resumenAnterior.set(resultado.anterior);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el resumen');
        this.cargando.set(false);
      },
    });
  }

  private rangoMesAnterior(): { desde: string; hasta: string } {
    const hoy = new Date();
    const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const finMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);
    return { desde: inicioMesAnterior.toISOString(), hasta: finMesAnterior.toISOString() };
  }

  variacion(campo: 'totalImporte' | 'totalPagado'): number | null {
    const actual = this.resumen()?.[campo] ?? 0;
    const anterior = this.resumenAnterior()?.[campo] ?? 0;

    if (anterior === 0) return null; // no se puede calcular % si el mes anterior fue 0
    return Math.round(((actual - anterior) / anterior) * 100);
  }



  maxCantidad(): number {
    const productos = this.resumen()?.productos ?? [];
    return Math.max(1, ...productos.map((p) => p.cantidad));
  }
}