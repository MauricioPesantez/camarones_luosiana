/**
 * Estado de una sesión de caja (R10, R13).
 *
 * Una `CajaSession` nace `ABIERTA` al iniciar la jornada y pasa a `CERRADA`
 * tras el cuadre y firma del día. Una sesión `CERRADA` bloquea la edición de
 * sus movimientos (Property 5).
 *
 * Se modela como objeto constante + tipo unión de literales para mantener el
 * dominio puro (sin depender del enum generado por Prisma). Los valores
 * coinciden exactamente con el enum `CajaEstado` del esquema Prisma
 * (`ABIERTA`, `CERRADA`).
 */
export const CajaEstado = {
  ABIERTA: "ABIERTA",
  CERRADA: "CERRADA",
} as const;

/** Unión de los valores válidos de estado de caja: 'ABIERTA' | 'CERRADA'. */
export type CajaEstado = (typeof CajaEstado)[keyof typeof CajaEstado];

/** Lista de todos los estados de caja válidos (validación e iteración). */
export const CAJA_ESTADOS: readonly CajaEstado[] = Object.values(CajaEstado);

/** Type guard: indica si un valor arbitrario es un `CajaEstado` válido. */
export function esCajaEstado(valor: unknown): valor is CajaEstado {
  return (
    typeof valor === "string" &&
    (CAJA_ESTADOS as readonly string[]).includes(valor)
  );
}
