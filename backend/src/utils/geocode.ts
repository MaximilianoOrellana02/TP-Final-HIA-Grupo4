import { coordenadasValidas } from './cliente.validation';

interface ResultadoGeocode {
  latitud: number;
  longitud: number;
}

const BOUNDING_BOX_JUJUY = {
  minLon: -65.45,
  minLat: -24.35,
  maxLon: -65.10,
  maxLat: -24.05,
};
export async function geocodificarDireccion(
  direccion: string,
  localidad?: string | null
): Promise<ResultadoGeocode | null> {
  try {
    const localidadFinal = localidad || 'San Salvador de Jujuy';
    const consulta = [direccion, localidadFinal, 'Jujuy', 'Argentina'].filter(Boolean).join(', ');


    const params = new URLSearchParams({
      format: 'json',
      limit: '1',
      q: consulta,
      countrycodes: 'ar', 
      viewbox: `${BOUNDING_BOX_JUJUY.minLon},${BOUNDING_BOX_JUJUY.minLat},${BOUNDING_BOX_JUJUY.maxLon},${BOUNDING_BOX_JUJUY.maxLat}`,
      bounded: '1', 
    });

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    const respuesta = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'SoderiaApp/1.0 (uso interno)',
      },
    });

    if (!respuesta.ok) return null;

    const datos = await respuesta.json();
    if (!Array.isArray(datos) || !datos[0]) return null;
    const latitud = typeof datos[0].lat === 'string' && datos[0].lat.trim() ? Number(datos[0].lat) : NaN;
    const longitud = typeof datos[0].lon === 'string' && datos[0].lon.trim() ? Number(datos[0].lon) : NaN;
    return coordenadasValidas(latitud, longitud) ? { latitud, longitud } : null;
  } catch (error) {
    console.error('Error al geocodificar:', error instanceof Error ? error.name : 'UnknownError');
    return null;
  }
}
