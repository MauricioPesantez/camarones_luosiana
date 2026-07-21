/**
 * Canal de una orden: la modalidad por la que llega el pedido (R4).
 *
 * Se modela como un objeto constante + tipo unión de literales para mantener
 * el dominio puro (sin depender del enum generado por Prisma). Los valores
 * coinciden exactamente con el enum `OrderChannel` del esquema Prisma
 * (`SALON`, `DELIVERY`, `RETIRAR`), de modo que el mapeo en los repositorios
 * es directo.
 */
export const OrderChannel = {
  SALON: "SALON",
  DELIVERY: "DELIVERY",
  RETIRAR: "RETIRAR",
} as const;

/** Unión de los valores válidos de canal: 'SALON' | 'DELIVERY' | 'RETIRAR'. */
export type OrderChannel = (typeof OrderChannel)[keyof typeof OrderChannel];

/** Lista de todos los canales válidos (útil para validación e iteración). */
export const ORDER_CHANNELS: readonly OrderChannel[] = Object.values(OrderChannel);

/** Type guard: indica si un valor arbitrario es un `OrderChannel` válido. */
export function esOrderChannel(valor: unknown): valor is OrderChannel {
  return (
    typeof valor === "string" &&
    (ORDER_CHANNELS as readonly string[]).includes(valor)
  );
}
