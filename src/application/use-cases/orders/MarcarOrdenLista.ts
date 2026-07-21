import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { RealtimeNotifier } from "@/application/ports/RealtimeNotifier";
import { Order } from "@/domain/order/Order";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";

/** Canal de notificación del KDS (R14). */
const CANAL_ORDENES = "orders";

/**
 * Caso de uso `MarcarOrdenLista` (R6.3, R15.1).
 *
 * Transiciona una orden de `EN_PREPARACION` a `LISTA`, la persiste y notifica al
 * KDS para que la mueva a la columna de listas. Marca la orden **completa**: no
 * hay estaciones ni preparación parcial (R15.1), de modo que una sola cocina
 * decide cuándo el pedido entero está terminado.
 *
 * La regla de qué transiciones son válidas (solo desde `EN_PREPARACION`) la hace
 * cumplir `Order.transicionarA`, que lanza `DomainError` (`ORDER_TRANSICION_INVALIDA`)
 * y conserva el estado si la orden no está en preparación (R6.7). Así, marcar
 * lista una orden ya `LISTA` o en cualquier otro estado se rechaza sin efecto.
 *
 * La confirmación modal y el toast de "Orden #N lista" (R15.2, R15.3) viven en
 * la capa de presentación (KDS, Tarea 21); este caso de uso solo orquesta la
 * transición y la notificación.
 */
export class MarcarOrdenLista {
  constructor(
    private readonly orders: OrderRepository,
    private readonly notifier: RealtimeNotifier,
  ) {}

  async ejecutar(orderId: string): Promise<Result<Order>> {
    try {
      const order = await this.orders.obtener(orderId);
      if (!order) {
        throw new DomainError(
          `No existe la orden ${orderId}`,
          "ORDER_NO_ENCONTRADA",
        );
      }

      order.transicionarA(OrderStatus.LISTA);
      await this.orders.guardar(order);
      await this.notifier.notificarCambio(CANAL_ORDENES);

      return ok(order);
    } catch (error) {
      if (error instanceof DomainError) {
        return err(error);
      }
      throw error;
    }
  }
}
