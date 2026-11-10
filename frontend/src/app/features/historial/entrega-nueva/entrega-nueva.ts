import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { forkJoin, map, Observable } from 'rxjs';
import { ClienteService } from '../../../core/services/cliente.service';
import { ProductoService } from '../../../core/services/producto.service';
import { HistorialService } from '../../../core/services/historial.service';
import { Cliente } from '../../../core/models/cliente.model';
import { Producto, precioVigente } from '../../../core/models/producto.model';
import { MetodoPago } from '../../../core/models/historial.model';
import { NotificationService } from '../../../core/services/notification.service';

import * as QRCode from 'qrcode';
import { MercadopagoService } from '../../../core/services/mercadopago.service';

interface LineaEntrega {
  productoId: string;
  nombre: string;
  stockActual: number;
  cantidadEntregada: number;
  cantidadEnvaseDevuelto: number;
  precioUnitario: number;
  envasesPreviosCliente: number; // lo que el cliente ya tenía pendiente ANTES de esta entrega
}

@Component({
  selector: 'app-entrega-nueva',
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './entrega-nueva.html',
  styleUrl: './entrega-nueva.css',
})
export default class EntregaNueva implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private clienteService = inject(ClienteService);
  private productoService = inject(ProductoService);
  private historialService = inject(HistorialService);
  private mercadopagoService = inject(MercadopagoService)
  private notificationService = inject(NotificationService);


  mpHabilitado = signal(false);
  mostrandoQR = signal(false);
  qrImagenUrl = signal<string | null>(null);
  verificandoPago = signal(false);
  private intervaloVerificacion?: ReturnType<typeof setInterval>;
  private referenciaActual = '';


  cliente = signal<Cliente | null>(null);
  lineas = signal<LineaEntrega[]>([]);
  observacion = '';
  opcionPago = signal<'todo' | 'nada' | 'otro'>('todo');
  montoPersonalizado = signal<number>(0);
  mostrarObservacion = signal(false);
  editandoSaldo = signal(false);
  nuevoSaldoAnterior = signal<number | null>(null);
  motivoAjuste = 'Deuda anterior al uso del sistema';

  cargando = signal(true);
  guardando = signal(false);
  verificandoStock = signal(false);
  error = signal<string | null>(null);
  metodoPago = signal<MetodoPago>('efectivo');

  importeTotal = computed(() =>
    this.lineas().reduce((acc, l) => acc + l.cantidadEntregada * l.precioUnitario, 0)
  );

  totalUnidades = computed(() =>
    this.lineas().reduce((acc, l) => acc + l.cantidadEntregada, 0)
  );

  montoPagado = computed(() => {
    if (this.opcionPago() === 'todo') {
      return this.importeTotal();
    } else if (this.opcionPago() === 'nada') {
      return 0;
    } else {
      return this.montoPersonalizado();
    }
  });

  seleccionarOpcionPago(opcion: 'todo' | 'nada' | 'otro') {
    this.opcionPago.set(opcion);
    if (opcion === 'otro' && this.montoPersonalizado() === 0) {
      this.montoPersonalizado.set(this.importeTotal());
    }
  }

  actualizarMontoPersonalizado(val: number | null) {
    this.montoPersonalizado.set(val ?? 0);
  }

  saldoRegistrado = computed(() => Number(this.cliente()?.saldoActual ?? 0));
  saldoAnterior = computed(() => this.editandoSaldo()
    ? (this.nuevoSaldoAnterior() ?? this.saldoRegistrado())
    : this.saldoRegistrado());

  iniciarAjusteSaldo() {
    this.nuevoSaldoAnterior.set(Math.max(0, this.saldoRegistrado()));
    this.motivoAjuste = 'Deuda anterior al uso del sistema';
    this.editandoSaldo.set(true);
  }

  cancelarAjusteSaldo() {
    this.editandoSaldo.set(false);
    this.nuevoSaldoAnterior.set(null);
    this.error.set(null);
  }

  private validarAjusteSaldo(): boolean {
    if (!this.editandoSaldo()) return true;
    const saldo = this.nuevoSaldoAnterior();
    if (saldo === null || !Number.isFinite(saldo) || saldo < 0 || saldo > 99_999_999.99 || Math.round(saldo * 100) / 100 !== saldo) {
      this.error.set('Ingresá una deuda anterior entre $0 y $99.999.999,99, con hasta dos decimales.');
      return false;
    }
    if (saldo === this.saldoRegistrado()) {
      this.error.set('El nuevo saldo es igual al registrado. Cambiá el valor o cancelá el ajuste.');
      return false;
    }
    if (!this.motivoAjuste.trim() || this.motivoAjuste.trim().length > 255) {
      this.error.set('Indicá el motivo del ajuste (hasta 255 caracteres).');
      return false;
    }
    return true;
  }

  saldoFinal = computed(
    () => this.saldoAnterior() + this.importeTotal() - this.montoPagado()
  );

  ngOnInit() {
    const clienteId = this.route.snapshot.paramMap.get('clienteId');
    if (!clienteId) {
      this.error.set('Cliente no especificado');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    forkJoin({
      cliente: this.clienteService.obtenerCliente(clienteId),
      productos: this.productoService.listar(),
      envases: this.clienteService.obtenerSaldoEnvases(clienteId),
    }).subscribe({
      next: ({ cliente, productos, envases }) => {
        this.cliente.set(cliente);

        const envasesPorProducto = new Map(envases.map((e) => [e.productoId, e.cantidad]));

        this.lineas.set(
          productos.map((p: Producto) => ({
            productoId: p.id,
            nombre: p.nombre,
            stockActual: Number(p.stockActual),
            cantidadEntregada: 0,
            cantidadEnvaseDevuelto: 0,
            precioUnitario: precioVigente(p, cliente.tipoCliente) ?? 0,
            envasesPreviosCliente: envasesPorProducto.get(p.id) ?? 0,
          }))
        );
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los datos');
        this.cargando.set(false);
      },
    });

    this.mercadopagoService.habilitado().subscribe({
      next: (r) => this.mpHabilitado.set(r.habilitado),
    });
  }

  generarQR() {
    if (!this.validarAjusteSaldo()) return;
    if (!this.hayMovimientos()) return;
    this.verificarStock(() => this.crearQR());
  }

  private async crearQR() {
    const cliente = this.cliente();
    if (!cliente) return;

    this.referenciaActual = `entrega-${cliente.id}-${Date.now()}`;

    this.mercadopagoService
      .crearPreferencia(this.importeTotal(), `Entrega a ${cliente.nombre} ${cliente.apellido}`, this.referenciaActual)
      .subscribe({
        next: async (pref) => {
          const link = pref.sandboxInitPoint || pref.initPoint; // sandbox mientras probás con credenciales de prueba
          const imagen = await QRCode.toDataURL(link, { width: 260 });
          this.qrImagenUrl.set(imagen);
          this.mostrandoQR.set(true);
          this.iniciarVerificacionPago();
        },
        error: () => {
          this.error.set('No se pudo generar el QR de pago');
        },
      });
  }

  private iniciarVerificacionPago() {
    this.verificandoPago.set(true);
    this.intervaloVerificacion = setInterval(() => {
      this.mercadopagoService.estadoPago(this.referenciaActual).subscribe({
        next: (r) => {
          if (r.pagado) {
            this.detenerVerificacionPago();
            this.opcionPago.set('todo');
            this.mostrandoQR.set(false);
            this.confirmar();
          }
        },
      });
    }, 3000);
  }

  private detenerVerificacionPago() {
    if (this.intervaloVerificacion) clearInterval(this.intervaloVerificacion);
    this.verificandoPago.set(false);
  }

  cancelarQR() {
    this.detenerVerificacionPago();
    this.mostrandoQR.set(false);
  }

  // Máximo que se puede devolver: lo que ya tenía + lo que se le entrega ahora mismo
  maxEnvasesDevolvibles(linea: LineaEntrega): number {
    return linea.envasesPreviosCliente + linea.cantidadEntregada;
  }

  // Stock disponible por producto en el depósito.
  private stockDeposito(): Observable<Map<string, number>> {
    return this.productoService.listar().pipe(
      map((productos) => new Map(productos.map((p) => [p.id, Number(p.stockActual)]))),
    );
  }

  private aplicarStock(stockPorProducto: Map<string, number>) {
    this.lineas.update((lineas) =>
      lineas.map((linea) => ({ ...linea, stockActual: stockPorProducto.get(linea.productoId) ?? 0 }))
    );
  }

  sumar(linea: LineaEntrega) {
    if (linea.cantidadEntregada >= linea.stockActual) {
      this.error.set(`No hay stock suficiente de ${linea.nombre}. Disponible: ${linea.stockActual}`);
      return;
    }
    this.error.set(null);
    this.actualizarLinea(linea.productoId, { cantidadEntregada: linea.cantidadEntregada + 1 });
  }

  restar(linea: LineaEntrega) {
    if (linea.cantidadEntregada === 0) return;
    this.actualizarLinea(linea.productoId, { cantidadEntregada: linea.cantidadEntregada - 1 });
  }

  sumarEnvase(linea: LineaEntrega) {
    this.actualizarLinea(linea.productoId, { cantidadEnvaseDevuelto: linea.cantidadEnvaseDevuelto + 1 });
  }

  restarEnvase(linea: LineaEntrega) {
    if (linea.cantidadEnvaseDevuelto === 0) return;
    this.actualizarLinea(linea.productoId, { cantidadEnvaseDevuelto: linea.cantidadEnvaseDevuelto - 1 });
  }

  actualizarPrecio(linea: LineaEntrega, valor: number) {
    this.actualizarLinea(linea.productoId, { precioUnitario: Math.max(0, valor) });
  }

  actualizarEnvases(linea: LineaEntrega, valor: number) {
    const max = this.maxEnvasesDevolvibles(linea);
    this.actualizarLinea(linea.productoId, { cantidadEnvaseDevuelto: Math.max(0, Math.min(max, valor)) });
  }

  private actualizarLinea(productoId: string, cambios: Partial<LineaEntrega>) {
    this.lineas.update((lineas) =>
      lineas.map((l) => (l.productoId === productoId ? { ...l, ...cambios } : l))
    );
  }

  confirmar() {
    if (!this.validarAjusteSaldo()) return;
    this.verificarStock(() => this.registrarEntrega());
  }

  private hayMovimientos(): boolean {
    const hayMovimientos = this.lineas().some(
      (linea) => linea.cantidadEntregada > 0 || linea.cantidadEnvaseDevuelto > 0
    );

    if (!hayMovimientos) {
      this.error.set('Agregá al menos un producto entregado o un envase devuelto');
    }

    return hayMovimientos;
  }

  private verificarStock(continuar: () => void) {
    if (this.verificandoStock() || this.guardando()) return;

    this.verificandoStock.set(true);
    this.error.set(null);

    this.stockDeposito().subscribe({
      next: (stockPorProducto) => {
        this.aplicarStock(stockPorProducto);

        const faltantes = this.lineas().filter(
          (linea) => linea.cantidadEntregada > linea.stockActual
        );

        this.verificandoStock.set(false);

        if (faltantes.length > 0) {
          const detalle = faltantes
            .map(
              (linea) =>
                `${linea.nombre} (solicitado: ${linea.cantidadEntregada}, disponible: ${linea.stockActual})`
            )
            .join(', ');
          this.error.set(`Stock insuficiente: ${detalle}`);
          return;
        }

        continuar();
      },
      error: () => {
        this.verificandoStock.set(false);
        this.error.set('No se pudo verificar el stock. Intentá nuevamente.');
      },
    });
  }

  private registrarEntrega() {
    if (!this.validarAjusteSaldo()) return;
    const cliente = this.cliente();
    if (!cliente) return;

    this.notificationService.confirmar(
      `Confirmar entrega a ${cliente.nombre} ${cliente.apellido}`,
      this.armarResumen(),
      () => this.guardarEntrega(cliente),
      'Registrar entrega',
    );
  }

  private guardarEntrega(cliente: Cliente) {
    const detalles = this.lineas()
      .filter((l) => l.cantidadEntregada > 0 || l.cantidadEnvaseDevuelto > 0)
      .map((l) => ({
        productoId: l.productoId,
        cantidadEntregada: l.cantidadEntregada,
        cantidadEnvaseDevuelto: l.cantidadEnvaseDevuelto,
        precioUnitario: l.precioUnitario,
      }));


    this.guardando.set(true);
    this.error.set(null);

    this.historialService
      .crearEntrega({
        clienteId: cliente.id,
        montoPagado: this.montoPagado(),
        observacion: this.observacion || undefined,
        metodoPago: this.metodoPago(),
        detalles,
        ...(this.editandoSaldo() ? {
          ajusteSaldo: {
            saldoEsperado: this.saldoRegistrado(),
            saldoNuevo: this.nuevoSaldoAnterior()!,
            motivo: this.motivoAjuste.trim(),
          },
        } : {}),
      })
      .subscribe({
        next: () => {
          this.notificationService.mostrar(
            `Entrega a ${cliente.nombre} ${cliente.apellido} registrada correctamente.`,
            'success',
          );
          this.router.navigate(['/clientes', cliente.id]);
        },
        error: (err) => {
          this.guardando.set(false);
          this.error.set(err.error?.error ?? 'No se pudo registrar la entrega');
        },
      });
  }

  private armarResumen(): string {
    const lineasConMovimiento = this.lineas().filter(
      (l) => l.cantidadEntregada > 0 || l.cantidadEnvaseDevuelto > 0
    );

    const detalleTexto = lineasConMovimiento.length > 0
      ? lineasConMovimiento
        .map((l) => `• ${l.nombre}: ${l.cantidadEntregada} entregados, ${l.cantidadEnvaseDevuelto} envases devueltos`)
        .join('\n')
      : '(Entrega informal, sin productos cargados)';

    return (
      `${detalleTexto}\n\n` +
      (this.editandoSaldo()
        ? `Se cambiará el saldo anterior de $${this.saldoRegistrado()} a $${this.saldoAnterior()}.\nMotivo: ${this.motivoAjuste.trim()}\n\n`
        : `Saldo anterior: $${this.saldoAnterior()}\n`) +
      `Total: $${this.importeTotal()}\n` +
      `Pagó: $${this.montoPagado()} (${this.metodoPago() === 'efectivo' ? 'Efectivo' : this.metodoPago() === 'transferencia' ? 'Transferencia' : 'QR'})\n` +
      `Saldo final: $${this.saldoFinal()}`
    );
  }

  superaEsperado(linea: LineaEntrega): boolean {
    const max = linea.envasesPreviosCliente + linea.cantidadEntregada;
    return linea.cantidadEnvaseDevuelto > max;
  }
}
