import type { TransactionRunner } from "@/application/ports/TransactionRunner";
import { Order } from "@/domain/order/Order";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";

/**
 * Estados en los que se permite quitar ítems (R5.1).
 *
 * A diferencia de agregar, quitar **no** se permite en `ENTREGADA`: una cuenta
 * abierta (running tab) solo acumula ítems hasta el cobro.
 */
const ESTADOS_PERMITEN_QUITAR: readonly OrderStatus[] = [
  OrderStatus.ABIERTA,
  OrderStatus.EN_PREPARACION,
];

/** Datos de entrada para quitar un ítem de una orden. */
export interface QuitarItemInput {
  orderId: string;
  orderItemId: string;
}

/**
 * Caso de uso `QuitarItem` (R5.1, R5.2).
 *
 * Operación **transaccional**: quita el `OrderItem`, restaura (incrementa) el
 * `stockDelDia` del plato en la cantidad devuelta, recalcula los totales y
 * persiste la orden. El incremento de stock no reactiva la disponibilidad
 * automáticamente (decisión del administrador).
 */
export class QuitarItem {
  constructor(private readonly tx: TransactionRunner) {}

  async ejecutar(input: QuitarItemInput): Promise<Result<Order>> {
    try {
      const order = await this.tx.run(async ({ orders, menu }) => {
        const order = await orders.obtener(input.orderId);
        if (!order) {
          throw new DomainError(
            `No existe la orden ${input.orderId}`,
            "ORDER_NO_ENCONTRADA",
          );
        }

        if (!ESTADOS_PERMITEN_QUITAR.includes(order.estado)) {
          throw new DomainError(
            `No se pueden quitar ítems de una orden en estado ${order.estado}`,
            "ORDER_ESTADO_NO_PERMITE_QUITAR",
          );
        }

        const removido = order.quitarItem(input.orderItemId);
        if (!removido) {
          throw new DomainError(
            `La orden no contiene el ítem ${input.orderItemId}`,
            "ORDER_ITEM_NO_ENCONTRADO",
          );
        }

        // Restaura el stock de la cantidad devuelta.
        await menu.ajustarStock(removido.menuItemId, removido.cantidad);

        order.recalcular();
        await orders.guardar(order);
        return order;
      });

      return ok(order);
    } catch (error) {
      if (error instanceof DomainError) {
        return err(error);
      }
      throw error;
    }
  }
}
