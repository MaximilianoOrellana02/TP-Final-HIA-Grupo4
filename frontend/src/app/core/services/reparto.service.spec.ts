import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RepartoService } from './reparto.service';

describe('Reparto del día', () => {
  let service: RepartoService;
  let http: HttpTestingController;
  const reparto = { id: 'r1', usuarioId: 'u1', fecha: '2026-10-11', iniciadoEn: '2026-10-11T10:00:00Z', finalizadoEn: null };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(RepartoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no decide nada hasta consultar el backend; sin reparto está pendiente', () => {
    expect(service.comenzadoHoy()).toBeUndefined();
    service.cargarRepartoHoy().subscribe();
    http.expectOne((r) => r.url.endsWith('/repartos/hoy')).flush({ reparto: null, resumen: null });
    expect(service.comenzadoHoy()).toBe(false);
    expect(service.terminadoHoy()).toBe(false);
  });

  it('comenzar lo registra en el backend y terminar guarda el resumen', () => {
    service.registrarComienzo().subscribe();
    const comienzo = http.expectOne((r) => r.url.endsWith('/repartos/hoy/comenzar'));
    expect(comienzo.request.method).toBe('POST');
    comienzo.flush(reparto);
    expect(service.comenzadoHoy()).toBe(true);

    service.terminar().subscribe();
    const resumen = { entregas: 3, cobrado: 500 };
    http.expectOne((r) => r.url.endsWith('/repartos/hoy/terminar')).flush({
      reparto: { ...reparto, finalizadoEn: '2026-10-11T18:00:00Z' },
      resumen,
    });
    expect(service.terminadoHoy()).toBe(true);
    expect(service.resumen()).toEqual(resumen);
  });

  it('un reparto terminado trae su resumen al consultarlo', () => {
    service.cargarRepartoHoy().subscribe();
    http.expectOne((r) => r.url.endsWith('/repartos/hoy')).flush({
      reparto: { ...reparto, finalizadoEn: '2026-10-11T18:00:00Z' },
      resumen: { entregas: 1 },
    });
    expect(service.terminadoHoy()).toBe(true);
    expect(service.resumen()).toEqual({ entregas: 1 });
  });

  it('cancelar el fin vuelve a dejar el reparto en curso y descarta el resumen', () => {
    service.cargarRepartoHoy().subscribe();
    http.expectOne((r) => r.url.endsWith('/repartos/hoy')).flush({
      reparto: { ...reparto, finalizadoEn: '2026-10-11T18:00:00Z' },
      resumen: { entregas: 1 },
    });
    service.reabrir().subscribe();
    const reabrir = http.expectOne((r) => r.url.endsWith('/repartos/hoy/reabrir'));
    expect(reabrir.request.method).toBe('POST');
    reabrir.flush(reparto);
    expect(service.terminadoHoy()).toBe(false);
    expect(service.comenzadoHoy()).toBe(true);
    expect(service.resumen()).toBeNull();
  });

});
