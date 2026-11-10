import { Component, computed, inject, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RepartoService } from '../../core/services/reparto.service';
import { NotificationService } from '../../core/services/notification.service';

// Resumen del reparto terminado: lo que se vendió, cobró y quedó fiado.
@Component({
  selector: 'app-resumen-reparto-modal',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './resumen-reparto-modal.html',
  styleUrl: './resumen-reparto-modal.css',
})
export default class ResumenRepartoModal {
  repartoService = inject(RepartoService);
  private notificationService = inject(NotificationService);
  cerrar = output<void>();
  reabriendo = signal(false);

  resumen = this.repartoService.resumen;
  devueltos = computed(() => (this.resumen()?.productos ?? []).reduce((acc, p) => acc + p.devueltos, 0));
  entregados = computed(() => (this.resumen()?.productos ?? []).reduce((acc, p) => acc + p.cantidad, 0));

  // Por si se terminó el reparto por error: vuelve a quedar en curso.
  cancelarFin() {
    if (this.reabriendo()) return;
    this.notificationService.confirmar(
      'Cancelar fin de reparto',
      'El reparto de hoy vuelve a quedar en curso. Después lo podés terminar de nuevo.',
      () => this.confirmarCancelarFin(),
      'Volver al reparto',
    );
  }

  private confirmarCancelarFin() {
    this.reabriendo.set(true);
    this.repartoService.reabrir().subscribe({
      next: () => {
        this.notificationService.mostrar('El reparto volvió a quedar en curso.', 'success');
        this.cerrar.emit();
      },
      error: (err) => {
        this.reabriendo.set(false);
        this.notificationService.mostrar(err.error?.error ?? 'No se pudo cancelar el fin del reparto');
      },
    });
  }
}
