export const MAX_REFERENCIA_ENTREGA = 500;
const MAX_UBICACION_URL = 2048;
const ENLACE_INVALIDO = 'El enlace de ubicación debe ser de Google Maps y usar HTTPS';

// Hosts que solo sirven mapas; los demás de Google exigen la ruta /maps.
const HOSTS_DE_MAPAS = new Set(['maps.app.goo.gl', 'maps.google.com']);
const HOSTS_CON_RUTA_MAPS = new Set([
  'goo.gl',
  'google.com',
  'www.google.com',
  'google.com.ec',
  'www.google.com.ec',
]);

/** Devuelve el enlace de Google Maps si es seguro de mostrar; nunca lo descarga. */
export function normalizarUbicacionUrl(valor: string): string | null {
  const texto = valor.trim();
  if (!texto || texto.length > MAX_UBICACION_URL) return null;

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const esRutaMaps = url.pathname === '/maps' || url.pathname.startsWith('/maps/');
  return HOSTS_DE_MAPAS.has(url.hostname) || (HOSTS_CON_RUTA_MAPS.has(url.hostname) && esRutaMaps)
    ? texto
    : null;
}

export class UbicacionInvalidaError extends Error {}

export function normalizarReferenciaEntrega(valor: string | null | undefined): string | null {
  const texto = valor?.trim();
  if (!texto) return null;
  if (texto.length > MAX_REFERENCIA_ENTREGA) {
    throw new UbicacionInvalidaError(
      `La referencia de entrega admite hasta ${MAX_REFERENCIA_ENTREGA} caracteres`,
    );
  }
  return texto;
}

/** Valida datos externos; vacío significa que el dato no se conoce todavía. */
export function parsearUbicacionEntrega(datos: {
  ubicacionUrl?: unknown;
  referenciaEntrega?: unknown;
}): { ubicacionUrl: string | null; referenciaEntrega: string | null } {
  const { ubicacionUrl, referenciaEntrega } = datos;
  if (ubicacionUrl != null && typeof ubicacionUrl !== 'string') {
    throw new UbicacionInvalidaError(ENLACE_INVALIDO);
  }
  if (referenciaEntrega != null && typeof referenciaEntrega !== 'string') {
    throw new UbicacionInvalidaError('La referencia de entrega debe ser texto');
  }

  const enlace = ubicacionUrl?.trim() ? normalizarUbicacionUrl(ubicacionUrl) : null;
  if (ubicacionUrl?.trim() && !enlace) throw new UbicacionInvalidaError(ENLACE_INVALIDO);
  return { ubicacionUrl: enlace, referenciaEntrega: normalizarReferenciaEntrega(referenciaEntrega) };
}
