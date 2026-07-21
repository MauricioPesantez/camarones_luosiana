import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { RealtimeNotifier } from "@/application/ports/RealtimeNotifier";
import { Order } from "@/domain/order/Order";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";

/** Canal de notificación del KDS (R14). */
const CANAL_ORDENES = "orders";

/**
 * Caso de uso `EntregarOrden` (R6.4).
 *
 * Transiciona una orden de `LISTA` a `ENTREGADA`, la persiste y notifica al KDS
 * para que la retire de la cola de pendientes. A partir de `ENTREGADA` la orden
 * funciona como cuenta abierta (running tab) hasta el cobro.
 */
export class EntregarOrden {
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

      order.transicionarA(OrderStatus.ENTREGADA);
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
