import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { RealtimeNotifier } from "@/application/ports/RealtimeNotifier";
import { Order } from "@/domain/order/Order";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";

const CANAL_ORDENES = "orders";

/**
 * Caso de uso `IniciarPreparacion` (R6.2).
 *
 * Transiciona una orden de `ENVIADA_A_COCINA` a `EN_PREPARACION`, la persiste y
 * notifica al KDS (la orden cambia de columna en la cola).
 */
export class IniciarPreparacion {
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

      order.transicionarA(OrderStatus.EN_PREPARACION);
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
