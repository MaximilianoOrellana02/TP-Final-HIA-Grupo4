export type TipoCliente = 'particular' | 'confianza';
export type CategoriaCliente = 'domicilio' | 'restaurante';


export interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  direccion: string | null;
  telefono: string | null;
  localidad: string | null;
  barrioId: string | null;
  categoria: CategoriaCliente;
  saldoActual: number;
  tipoCliente: TipoCliente;
  saldosEnvase?: { productoId: string; cantidad: number }[];
  barrio?: { id: string; nombre: string };
  latitud: number | null;
  longitud: number | null;
  ultimaVisitaFecha: string | null;
  // Indicaciones para el repartidor: nota libre y referencia corta del lugar.
  notaRepartidor?: string | null;
  referencia?: string | null;
}

export interface ClienteInput {
  nombre: string;
  apellido: string;
  direccion?: string;
  telefono?: string;
  localidad?: string;
  notaRepartidor?: string;
  referencia?: string;
  barrioId?: string;
  categoria?: CategoriaCliente;
  tipoCliente?: TipoCliente;
  latitud?: number | null;
  longitud?: number | null;
}

export interface ClienteDeudaVieja {
  id: string;
  nombre: string;
  apellido: string;
  saldoActual: number;
  diasSinPagar: number;
}

// Entregas con producto de cada cliente (los que nunca recibieron nada no aparecen).
export interface ActividadCliente {
  clienteId: string;
  ultimaEntrega: string | null;
  entregasUltimos30: number;
  // 4 o más entregas en los últimos 30 días.
  frecuente: boolean;
}

export interface ActividadClientes {
  // Clientes con al menos una entrega en el mes en curso.
  activosMes: number;
  clientes: ActividadCliente[];
}