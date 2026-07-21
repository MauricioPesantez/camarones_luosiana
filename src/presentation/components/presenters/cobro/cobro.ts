import { MetodoPago } from "@/domain/order/MetodoPago";
import { OrderStatus } from "@/domain/order/OrderStatus";
import type { OrderDTO } from "@/presentation/http/dto";

/**
 * Lógica de vista pura de la pantalla de cobro (R9).
 *
 * Sin React ni fetching: qué órdenes son cobrables, etiquetas de método,
 * mensajes de confirmación/toast y formato de monto. Aislado para probarlo en
 * Node; el container y los presenters solo consumen estas funciones.
 */

export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
};

/** Solo se cobra una orden `ENTREGADA` (R9.2). */
export function esCobrable(order: OrderDTO): boolean {
  return order.estado === OrderStatus.ENTREGADA;
}

/** Filtra las órdenes cobrables de la lista de activas. */
export function ordenesCobrables(orders: readonly OrderDTO[]): OrderDTO[] {
  return orders.filter(esCobrable).sort((a, b) => a.numero - b.numero);
}

/** Formatea un monto como moneda: `$12.50`. */
export function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Mensaje del modal de confirmación de cobro (R9.4). */
export function mensajeConfirmarCobro(
  total: number,
  metodo: MetodoPago,
): string {
  return `¿Registrar el cobro de ${formatMoney(total)} en ${ETIQUETA_METODO[metodo]}?`;
}

/** Toast tras registrar el cobro (R9.4). */
export function mensajeCobroRegistrado(numero: number): string {
  return `Cobro registrado · orden #${numero}`;
}

/** Toast al cargar el comprobante de transferencia (R9.5). */
export const MENSAJE_COMPROBANTE_CARGADO = "Comprobante cargado";

/**
 * Un cobro es enviable si hay orden cobrable y, en transferencia, comprobante
 * cargado (R9.3). En efectivo no requiere adjunto.
 */
export function puedeRegistrarCobro(
  order: OrderDTO | null,
  metodo: MetodoPago,
  tieneComprobante: boolean,
): boolean {
  if (!order || !esCobrable(order)) return false;
  if (metodo === MetodoPago.TRANSFERENCIA) return tieneComprobante;
  return true;
}
