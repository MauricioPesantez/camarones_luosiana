import { OrderStatus } from "@/domain/order/OrderStatus";
import type { OrderDTO } from "@/presentation/http/dto";

/**
 * Lógica de vista pura del KDS (pantalla de cocina).
 *
 * Sin React ni fetching: qué órdenes ve cocina, orden de la cola, badges y
 * mensajes. Aislado para probarlo en Node; el container y los presenters solo
 * consumen estas funciones.
 */

/** Intervalo de polling dentro del rango permitido (R14.1: 3–5s). */
export const INTERVALO_POLLING_MS = 4000;

/**
 * Estados relevantes para cocina: enviada (sin atender), en preparación y lista
 * (esperando que el mesero la entregue). Se excluyen `ABIERTA` (aún en toma),
 * `ENTREGADA`/`COBRADA` y los terminales.
 */
const ESTADOS_COCINA: readonly OrderStatus[] = [
  OrderStatus.ENVIADA_A_COCINA,
  OrderStatus.EN_PREPARACION,
  OrderStatus.LISTA,
];

/** Una orden sin atender es la que llegó a cocina y aún no se inicia (R14.3). */
export function sinAtender(order: OrderDTO): boolean {
  return order.estado === OrderStatus.ENVIADA_A_COCINA;
}

/**
 * Cola de cocina: filtra a los estados relevantes y ordena por antigüedad
 * (número ascendente), con las órdenes sin atender primero para destacarlas.
 */
export function colaCocina(orders: readonly OrderDTO[]): OrderDTO[] {
  return orders
    .filter((o) => ESTADOS_COCINA.includes(o.estado))
    .sort((a, b) => {
      const prioridad = Number(sinAtender(b)) - Number(sinAtender(a));
      if (prioridad !== 0) return prioridad;
      return a.numero - b.numero;
    });
}

/** Se puede iniciar preparación solo desde `ENVIADA_A_COCINA` (R6.2). */
export function puedeIniciar(order: OrderDTO): boolean {
  return order.estado === OrderStatus.ENVIADA_A_COCINA;
}

/** Se puede marcar lista solo desde `EN_PREPARACION` (R6.3, R15.1). */
export function puedeMarcarLista(order: OrderDTO): boolean {
  return order.estado === OrderStatus.EN_PREPARACION;
}

/** Mensaje del modal de confirmación de marcar lista (R15.2). */
export function mensajeConfirmarLista(numero: number): string {
  return `¿Deseas marcar la orden #${numero} como terminada?`;
}

/** Toast tras confirmar marcar lista (R15.3). */
export function mensajeOrdenLista(numero: number): string {
  return `Orden #${numero} lista`;
}
