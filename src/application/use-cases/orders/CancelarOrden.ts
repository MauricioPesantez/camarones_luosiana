import type { SessionUser } from "@/application/ports/AuthService";
import type { Clock } from "@/application/ports/Clock";
import type { IdGenerator } from "@/application/ports/IdGenerator";
import type { TransactionRunner } from "@/application/ports/TransactionRunner";
import { AuditEntry } from "@/domain/audit/AuditEntry";
import { Order } from "@/domain/order/Order";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";
import { Role } from "@/domain/user/Role";

/** Acción registrada en auditoría al cancelar una orden (R16.2). */
export const ACCION_CANCELAR_ORDEN = "CANCELAR_ORDEN";

/** Datos de entrada para cancelar una orden. */
export interface CancelarOrdenInput {
  orderId: string;
  /** Usuario que solicita la cancelación (de la sesión verificada). */
  actor: SessionUser;
  /** Motivo opcional, persistido en el detalle de auditoría. */
  motivo?: string;
}

/**
 * Caso de uso `CancelarOrden` (R6.8, R7.1, R7.2, R7.3, R16.1).
 *
 * Operación **transaccional**: cambia el estado de la orden a `CANCELADA`,
 * restaura el `stockDelDia` de cada ítem y persiste un `AuditEntry`. Todo se
 * confirma o se revierte junto.
 *
 * Autorización en profundidad (Property 8): cancelar desde `ENVIADA_A_COCINA`,
 * `EN_PREPARACION` o `COBRADA` exige rol admin; cancelar desde `ABIERTA` lo
 * puede hacer cualquier usuario autorizado (R6.8). La regla de admin la hace
 * cumplir `Order.transicionarA`, que rechaza con `DomainError` antes de tocar
 * el stock.
 */
export class CancelarOrden {
  constructor(
    private readonly tx: TransactionRunner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async ejecutar(input: CancelarOrdenInput): Promise<Result<Order>> {
    try {
      const esAdmin = input.actor.roles.includes(Role.ADMIN);

      const order = await this.tx.run(async ({ orders, menu, audit }) => {
        const order = await orders.obtener(input.orderId);
        if (!order) {
          throw new DomainError(
            `No existe la orden ${input.orderId}`,
            "ORDER_NO_ENCONTRADA",
          );
        }

        const estadoPrevio = order.estado;

        // Hace cumplir la máquina de estados y la regla de admin (R7.1, R7.2):
        // lanza antes de restaurar stock si la cancelación no está permitida.
        order.transicionarA(OrderStatus.CANCELADA, { esAdmin });

        // Restaura el stock que cada ítem había decrementado (R5.2 / R7).
        for (const item of order.items) {
          await menu.ajustarStock(item.menuItemId, item.cantidad);
        }

        await orders.guardar(order);

        // Registro de auditoría de la acción sensible (R7.3, R16.1).
        const entrada = AuditEntry.crear({
          id: this.ids.generate(),
          usuarioId: input.actor.id,
          accion: ACCION_CANCELAR_ORDEN,
          entidadTipo: "Order",
          entidadId: order.id,
          detalle: {
            estadoPrevio,
            motivo: input.motivo ?? null,
          },
          timestamp: this.clock.now(),
        });
        await audit.registrar(entrada);

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
