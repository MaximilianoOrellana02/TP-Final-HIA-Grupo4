export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export interface Barrio {
  id: string;
  nombre: string;
  diasVisita: DiaSemana[];
}

export const DIAS_SEMANA: { valor: DiaSemana; etiqueta: string }[] = [
  { valor: 'lunes', etiqueta: 'Lunes' },
  { valor: 'martes', etiqueta: 'Martes' },
  { valor: 'miercoles', etiqueta: 'Miércoles' },
  { valor: 'jueves', etiqueta: 'Jueves' },
  { valor: 'viernes', etiqueta: 'Viernes' },
  { valor: 'sabado', etiqueta: 'Sábado' },
  { valor: 'domingo', etiqueta: 'Domingo' },
];

// Mapea el número que devuelve JS (0=domingo, 1=lunes...) a nuestro formato
export function diaDeHoy(): DiaSemana {
  const dias: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return dias[new Date().getDay()];
}