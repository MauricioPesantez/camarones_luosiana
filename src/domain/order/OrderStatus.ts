/**
 * Estado de una orden dentro de su ciclo de vida (R6).
 *
 * Se modela como un objeto constante + tipo unión de literales para mantener
 * el dominio puro (sin depender del enum generado por Prisma). Los valores
 * coinciden exactamente con el enum `OrderStatus` del esquema Prisma
 * (`ABIERTA`, `ENVIADA_A_COCINA`, `EN_PREPARACION`, `LISTA`, `ENTREGADA`,
 * `COBRADA`, `CERRADA`, `CANCELADA`).
 *
 * La máquina de estados (transiciones permitidas y estados terminales) se
 * implementa en la Tarea 4.3 (`Order.transicionarA`).
 */
export const OrderStatus = {
  ABIERTA: "ABIERTA",
  ENVIADA_A_COCINA: "ENVIADA_A_COCINA",
  EN_PREPARACION: "EN_PREPARACION",
  LISTA: "LISTA",
  ENTREGADA: "ENTREGADA",
  COBRADA: "COBRADA",
  CERRADA: "CERRADA",
  CANCELADA: "CANCELADA",
} as const;

/** Unión de los valores válidos de estado de orden. */
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** Lista de todos los estados válidos (útil para validación e iteración). */
export const ORDER_STATUSES: readonly OrderStatus[] = Object.values(OrderStatus);

/** Type guard: indica si un valor arbitrario es un `OrderStatus` válido. */
export function esOrderStatus(valor: unknown): valor is OrderStatus {
  return (
    typeof valor === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(valor)
  );
}
