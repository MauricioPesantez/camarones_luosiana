export const ZONA_HORARIA = 'America/Guayaquil';

const FECHA_LOCAL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convierte una fecha local (YYYY-MM-DD en Ecuador) al rango UTC que la cubre.
 *
 * Es la unica definicion de "el dia" para el cuadre: las ordenes y los retiros
 * se consultan con este mismo rango, asi que nunca pueden quedar agrupados en
 * dias distintos.
 *
 * Devuelve `null` si el formato no calza o si la fecha no existe (31/02), que
 * `Date` normalizaria en silencio al 3 de marzo.
 */
export function obtenerRangoEcuador(
  fecha: string,
): { inicio: Date; fin: Date } | null {
  if (!FECHA_LOCAL.test(fecha)) return null;

  const [year, month, day] = fecha.split('-').map(Number);
  const inicio = new Date(Date.UTC(year, month - 1, day, 5));

  const fechaValidada = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(inicio);
  if (fechaValidada !== fecha) return null;

  return { inicio, fin: new Date(inicio.getTime() + 24 * 60 * 60 * 1000) };
}

/** Fecha de hoy en Ecuador, en el formato que aceptan las rutas. */
export function obtenerFechaEcuador(referencia: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referencia);
}
