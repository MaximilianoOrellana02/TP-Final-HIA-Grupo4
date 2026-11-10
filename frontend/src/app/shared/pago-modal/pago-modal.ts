import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HistorialService } from '../../core/services/historial.service';
import { MetodoPago } from '../../core/models/historial.model';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-pago-modal',
  imports: [FormsModule],
  templateUrl: './pago-modal.html',
  styleUrl: './pago-modal.css',
})
export default class PagoModal {
  private historialService = inject(HistorialService);
  private notificationService = inject(NotificationService);

  clienteId = input.required<string>();
  nombreCliente = input.required<string>();
  saldoActual = input.required<number>();

  cerrar = output<void>();
  pagoRegistrado = output<void>();

  monto = 0;
  metodoPago = signal<MetodoPago>('efectivo');
  observacion = '';
  guardando = signal(false);
  error = signal<string | null>(null);

  confirmar() {
    if (this.monto <= 0) {
      this.error.set('El monto tiene que ser mayor a 0');
      return;
    }

    const saldoFinal = this.saldoActual() - this.monto;
    const formatoMonto = (valor: number) => `$${valor.toLocaleString('es-AR')}`;

    this.notificationService.confirmar(
      `Registrar pago de ${this.nombreCliente()}`,
      '',
      () => this.registrarPago(),
      'Registrar pago',
      {
        etiquetaSuperior: 'Nuevo pago',
        advertencia: saldoFinal < 0
          ? `El pago supera la deuda. El cliente quedará con ${formatoMonto(Math.abs(saldoFinal))} a favor.`
          : undefined,
        detalles: [
          { etiqueta: 'Cliente', valor: this.nombreCliente() },
          { etiqueta: 'Monto', valor: formatoMonto(this.monto) },
          {
            etiqueta: 'Método',
            valor: this.metodoPago() === 'efectivo' ? 'Efectivo' : 'Transferencia',
            tono: 'info',
          },
          { etiqueta: 'Saldo anterior', valor: formatoMonto(this.saldoActual()) },
          { etiqueta: 'Saldo final', valor: formatoMonto(saldoFinal) },
        ],
      },
    );
  }

  private registrarPago() {
    this.guardando.set(true);
    this.error.set(null);

    this.historialService
      .crearEntrega({
        clienteId: this.clienteId(),
        montoPagado: this.monto,
        observacion: this.observacion || 'Pago sin entrega',
        metodoPago: this.metodoPago(),
        detalles: [],
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.notificationService.mostrar(
            `Pago de $${this.monto.toLocaleString('es-AR')} registrado correctamente.`,
            'success',
          );
          this.pagoRegistrado.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.error.set(err.error?.error ?? 'No se pudo registrar el pago');
        },
      });
  }
}
