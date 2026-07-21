/**
 * Tipo de un movimiento de caja (R11, R12, R13).
 *
 * Describe el evento de dinero que originó el movimiento: apertura del fondo,
 * ventas (efectivo/transferencia), pago de carrera de delivery, egresos
 * (proveedor, compra menor, retiro), ingresos manuales y el cierre del día.
 *
 * Se modela como objeto constante + tipo unión de literales para mantener el
 * dominio puro (sin depender del enum generado por Prisma). Los valores
 * coinciden exactamente con el enum `TipoMovimiento` del esquema Prisma.
 */
export const TipoMovimiento = {
  APERTURA: "APERTURA",
  VENTA_EFECTIVO: "VENTA_EFECTIVO",
  VENTA_TRANSFERENCIA: "VENTA_TRANSFERENCIA",
  PAGO_CARRERA: "PAGO_CARRERA",
  PAGO_PROVEEDOR: "PAGO_PROVEEDOR",
  COMPRA_MENOR: "COMPRA_MENOR",
  INGRESO_MANUAL: "INGRESO_MANUAL",
  RETIRO_MANUAL: "RETIRO_MANUAL",
  CIERRE: "CIERRE",
} as const;

/** Unión de los valores válidos de tipo de movimiento. */
export type TipoMovimiento =
  (typeof TipoMovimiento)[keyof typeof TipoMovimiento];

/** Lista de todos los tipos de movimiento válidos (validación e iteración). */
export const TIPOS_MOVIMIENTO: readonly TipoMovimiento[] =
  Object.values(TipoMovimiento);

/** Type guard: indica si un valor arbitrario es un `TipoMovimiento` válido. */
export function esTipoMovimiento(valor: unknown): valor is TipoMovimiento {
  return (
    typeof valor === "string" &&
    (TIPOS_MOVIMIENTO as readonly string[]).includes(valor)
  );
}
