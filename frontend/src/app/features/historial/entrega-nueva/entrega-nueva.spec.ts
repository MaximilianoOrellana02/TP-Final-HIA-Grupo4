import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import EntregaNueva from './entrega-nueva';
import { ClienteService } from '../../../core/services/cliente.service';
import { ProductoService } from '../../../core/services/producto.service';
import { HistorialService } from '../../../core/services/historial.service';
import { MercadopagoService } from '../../../core/services/mercadopago.service';
import { NotificationService } from '../../../core/services/notification.service';

describe('Deuda anterior en la entrega', () => {
  let component: EntregaNueva;
  let notificationService: NotificationService;
  const crearEntrega = vi.fn();
  const navigate = vi.fn();

  beforeEach(() => {
    crearEntrega.mockReset().mockReturnValue(of({}));
    navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: { navigate } },
        { provide: ClienteService, useValue: {} },
        { provide: ProductoService, useValue: { listar: () => of([{ id: 'producto', stockActual: 10 }]) } },
        { provide: HistorialService, useValue: { crearEntrega } },
        { provide: MercadopagoService, useValue: {} },
      ],
    });
    notificationService = TestBed.inject(NotificationService);
    component = TestBed.runInInjectionContext(() => new EntregaNueva());
    component.cliente.set({
      id: 'cliente', nombre: 'Ana', apellido: 'Prueba', saldoActual: 500,
      direccion: null, telefono: null, localidad: null, barrioId: null,
      categoria: 'domicilio', tipoCliente: 'particular', latitud: null, longitud: null, ultimaVisitaFecha: null,
    });
    component.lineas.set([{
      productoId: 'producto', nombre: 'Agua', stockActual: 10, cantidadEntregada: 2,
      cantidadEnvaseDevuelto: 0, precioUnitario: 100, envasesPreviosCliente: 0,
    }]);
    component.opcionPago.set('otro');
    component.montoPersonalizado.set(50);
  });

  afterEach(() => vi.restoreAllMocks());

  it('reemplaza el saldo en la vista previa y cancelar el ajuste restaura el original', () => {
    component.iniciarAjusteSaldo();
    component.nuevoSaldoAnterior.set(15000);
    expect(component.saldoFinal()).toBe(15150);
    expect(component.saldoRegistrado()).toBe(500);
    component.cancelarAjusteSaldo();
    expect(component.saldoFinal()).toBe(650);
    expect(crearEntrega).not.toHaveBeenCalled();
  });

  it('no guarda nada si se cancela la confirmación de la entrega', () => {
    component.iniciarAjusteSaldo();
    component.nuevoSaldoAnterior.set(15000);
    component.confirmar();
    notificationService.cerrar();
    expect(crearEntrega).not.toHaveBeenCalled();
    expect(component.saldoRegistrado()).toBe(500);
  });

  it('confirma ambos saldos y envía el ajuste junto con la entrega', () => {
    component.iniciarAjusteSaldo();
    component.nuevoSaldoAnterior.set(15000);
    component.confirmar();
    expect(notificationService.notificacion()).toEqual(expect.objectContaining({
      titulo: 'Confirmar entrega a Ana Prueba',
      mensaje: expect.stringContaining('de $500 a $15000'),
      etiquetaConfirmacion: 'Registrar entrega',
    }));
    notificationService.aceptarConfirmacion();
    expect(crearEntrega).toHaveBeenCalledWith(expect.objectContaining({
      montoPagado: 50,
      ajusteSaldo: { saldoEsperado: 500, saldoNuevo: 15000, motivo: 'Deuda anterior al uso del sistema' },
    }));
    expect(navigate).toHaveBeenCalledWith(['/clientes', 'cliente']);
  });

  it('mantiene la entrega habitual sin un ajuste implícito', () => {
    component.confirmar();
    notificationService.aceptarConfirmacion();
    expect(crearEntrega.mock.calls[0][0]).not.toHaveProperty('ajusteSaldo');
  });

  it('bloquea saldos vacíos, negativos, fuera de rango, iguales o con más de dos decimales', () => {
    component.iniciarAjusteSaldo();
    for (const saldo of [null, -1, NaN, Infinity, 100000000, 500, 1.005]) {
      component.nuevoSaldoAnterior.set(saldo);
      component.confirmar();
      expect(component.error()).toBeTruthy();
    }
    component.nuevoSaldoAnterior.set(15000);
    component.motivoAjuste = ' ';
    component.confirmar();
    expect(crearEntrega).not.toHaveBeenCalled();
    expect(notificationService.notificacion()).toBeNull();
  });

  it('conserva el formulario y avisa si el servidor detecta un saldo desactualizado', () => {
    crearEntrega.mockReturnValue(throwError(() => ({ status: 409, error: { error: 'El saldo del cliente cambio' } })));
    component.iniciarAjusteSaldo();
    component.nuevoSaldoAnterior.set(15000);
    component.confirmar();
    notificationService.aceptarConfirmacion();
    expect(component.error()).toBe('El saldo del cliente cambio');
    expect(component.guardando()).toBe(false);
    expect(component.nuevoSaldoAnterior()).toBe(15000);
    expect(component.saldoRegistrado()).toBe(500);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('la entrega no envía camioneta: siempre sale del depósito', () => {
    component.confirmar();
    notificationService.aceptarConfirmacion();
    expect(crearEntrega).toHaveBeenCalled();
    expect(crearEntrega.mock.calls[0][0]).not.toHaveProperty('camionetaId');
  });
});
