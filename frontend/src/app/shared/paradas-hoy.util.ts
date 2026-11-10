import { Barrio, DiaSemana, diaDeHoy } from '../core/models/barrio.model';
import { Cliente } from '../core/models/cliente.model';

// Día comercial de Argentina (AAAA-MM-DD), el mismo que usa el backend.
export function hoyEnArgentina(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

const claveRestaurantes = () => 'hoy_restaurantes_' + hoyEnArgentina();

// En Hoy se puede sumar a los restaurantes a la ruta del día; Clientes lo lee para numerar igual.
export function restaurantesIncluidosHoy(): boolean {
  try {
    return localStorage.getItem(claveRestaurantes()) === 'true';
  } catch {
    return false;
  }
}

export function guardarRestaurantesIncluidosHoy(activo: boolean) {
  try {
    localStorage.setItem(claveRestaurantes(), String(activo));
  } catch {
    // Sin almacenamiento solo se pierde la preferencia al recargar.
  }
}

export interface ParadasDeHoy {
  // Clientes con reparto hoy (barrio con visita hoy, más restaurantes si se incluyen).
  deHoy: Cliente[];
  // De esos, los que todavía no se visitaron, en el orden en que se recorren ("Parada N").
  pendientes: Cliente[];
  // Todos los clientes visitados hoy, estén o no en la ruta.
  realizadas: Cliente[];
}

// Cálculo único de la ruta del día: lo usan Hoy y Clientes para que "Parada N" coincida en las dos pantallas.
export function calcularParadas(clientes: Cliente[], barrios: Barrio[], incluirRestaurantes: boolean): ParadasDeHoy {
  const hoy = diaDeHoy();
  const fecha = hoyEnArgentina();
  const deHoy = clientes.filter((c) => {
    const barrio = barrios.find((b) => b.id === c.barrioId);
    const tocaHoy = (barrio?.diasVisita as DiaSemana[] | undefined)?.includes(hoy) ?? false;
    return tocaHoy || (incluirRestaurantes && c.categoria === 'restaurante');
  });
  return {
    deHoy,
    pendientes: deHoy.filter((c) => c.ultimaVisitaFecha !== fecha),
    realizadas: clientes.filter((c) => c.ultimaVisitaFecha === fecha),
  };
}
