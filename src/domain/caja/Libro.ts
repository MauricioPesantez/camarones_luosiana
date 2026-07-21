/**
 * Libro contable de un movimiento de caja (R11, R13).
 *
 * Clasifica cada `MovimientoCaja` según el medio: dinero físico (`EFECTIVO`)
 * o transferencia bancaria (`TRANSFERENCIA`). El cierre de caja deriva el
 * efectivo esperado sumando únicamente los movimientos del libro `EFECTIVO`.
 *
 * Se modela como objeto constante + tipo unión de literales para mantener el
 * dominio puro (sin depender del enum generado por Prisma). Los valores
 * coinciden exactamente con el enum `Libro` del esquema Prisma
 * (`EFECTIVO`, `TRANSFERENCIA`), de modo que el mapeo en los repositorios es
 * directo.
 */
export const Libro = {
  EFECTIVO: "EFECTIVO",
  TRANSFERENCIA: "TRANSFERENCIA",
} as const;

/** Unión de los valores válidos de libro: 'EFECTIVO' | 'TRANSFERENCIA'. */
export type Libro = (typeof Libro)[keyof typeof Libro];

/** Lista de todos los libros válidos (útil para validación e iteración). */
export const LIBROS: readonly Libro[] = Object.values(Libro);

/** Type guard: indica si un valor arbitrario es un `Libro` válido. */
export function esLibro(valor: unknown): valor is Libro {
  return (
    typeof valor === "string" && (LIBROS as readonly string[]).includes(valor)
  );
}
