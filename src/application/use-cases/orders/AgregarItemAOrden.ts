import type { IdGenerator } from "@/application/ports/IdGenerator";
import type { TransactionRunner } from "@/application/ports/TransactionRunner";
import { Order } from "@/domain/order/Order";
import { OrderItem } from "@/domain/order/OrderItem";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";

/** Estados en los que se permite agregar ítems (R5.1, R5.5: running tab). */
const ESTADOS_PERMITEN_AGREGAR: readonly OrderStatus[] = [
  OrderStatus.ABIERTA,
  OrderStatus.EN_PREPARACION,
  OrderStatus.ENTREGADA,
];

/** Datos de entrada para agregar un ítem a una orden. */
export interface AgregarItemInput {
  orderId: string;
  menuItemId: string;
  cantidad: number;
}

/**
 * Caso de uso `AgregarItemAOrden` (R3.3, R3.4, R5.1, R5.5).
 *
 * Operación **transaccional**: verifica disponibilidad del plato, decrementa su
 * `stockDelDia` (con auto-86 al llegar a 0), agrega el `OrderItem` con snapshot
 * de nombre y precio, recalcula los totales y persiste la orden. Todo se
 * confirma o se revierte junto (Property 7): no se decrementa stock sin guardar
 * la orden.
 *
 * Permitido en `ABIERTA`, `EN_PREPARACION` y `ENTREGADA` (cuenta abierta /
 * running tab). En cualquier otro estado se rechaza.
 */
export class AgregarItemAOrden {
  constructor(
    private readonly tx: TransactionRunner,
    private readonly ids: IdGenerator,
  ) {}

  async ejecutar(input: AgregarItemInput): Promise<Result<Order>> {
    try {
      const order = await this.tx.run(async ({ orders, menu }) => {
        const order = await orders.obtener(input.orderId);
        if (!order) {
          throw new DomainError(
            `No existe la orden ${input.orderId}`,
            "ORDER_NO_ENCONTRADA",
          );
        }

        if (!ESTADOS_PERMITEN_AGREGAR.includes(order.estado)) {
          throw new DomainError(
            `No se pueden agregar ítems a una orden en estado ${order.estado}`,
            "ORDER_ESTADO_NO_PERMITE_AGREGAR",
          );
        }

        const plato = await menu.obtener(input.menuItemId);
        if (!plato) {
          throw new DomainError(
            `No existe el plato ${input.menuItemId}`,
            "MENU_ITEM_NO_ENCONTRADO",
          );
        }
        if (!plato.disponible) {
          throw new DomainError(
            `El plato ${plato.nombre} no está disponible`,
            "MENU_ITEM_NO_DISPONIBLE",
          );
        }

        // Decrementa el stock de forma atómica (lanza si es insuficiente y
        // aplica auto-86 cuando llega a 0).
        await menu.ajustarStock(input.menuItemId, -input.cantidad);

        const item = OrderItem.crear({
          id: this.ids.generate(),
          menuItemId: plato.id,
          nombrePlato: plato.nombre,
          precioUnit: plato.precio,
          cantidad: input.cantidad,
        });
        order.agregarItem(item);
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
