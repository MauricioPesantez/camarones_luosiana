/**
 * Método de pago aceptado para el cobro de una orden (R9.1).
 *
 * El sistema solo admite `EFECTIVO` o `TRANSFERENCIA`; no hay tarjeta ni pago
 * dividido en la v1. Se modela como objeto constante + tipo unión de literales
 * para mantener el dominio puro (sin depender del enum generado por Prisma).
 * Los valores coinciden exactamente con el enum `MetodoPago` del esquema Prisma
 * (`EFECTIVO`, `TRANSFERENCIA`), de modo que el mapeo en los repositorios es
 * directo.
 */
export const MetodoPago = {
  EFECTIVO: "EFECTIVO",
  TRANSFERENCIA: "TRANSFERENCIA",
} as const;

/** Unión de los valores válidos de método de pago: 'EFECTIVO' | 'TRANSFERENCIA'. */
export type MetodoPago = (typeof MetodoPago)[keyof typeof MetodoPago];

/** Lista de todos los métodos de pago válidos (útil para validación e iteración). */
export const METODOS_PAGO: readonly MetodoPago[] = Object.values(MetodoPago);

/** Type guard: indica si un valor arbitrario es un `MetodoPago` válido. */
export function esMetodoPago(valor: unknown): valor is MetodoPago {
  return (
    typeof valor === "string" &&
    (METODOS_PAGO as readonly string[]).includes(valor)
  );
}
