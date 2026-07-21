import type { IdGenerator } from "@/application/ports/IdGenerator";
import type { TransactionRunner } from "@/application/ports/TransactionRunner";
import { Money } from "@/domain/order/Money";
import { Order } from "@/domain/order/Order";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderItem } from "@/domain/order/OrderItem";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";

/** Línea del carrito enviada al crear la orden. */
export interface CrearOrdenItemInput {
  menuItemId: string;
  cantidad: number;
}

/**
 * Datos de entrada para crear una orden ya con sus ítems (R4, R5).
 *
 * A diferencia de `CrearOrden` (que crea una orden vacía y luego se van
 * agregando ítems uno a uno), este caso de uso persiste el canal y todos los
 * ítems en una sola operación: el mesero arma la orden completa en pantalla y
 * la crea al final.
 */
export interface CrearOrdenConItemsInput {
  canal: OrderChannel;
  creadoPorId: string;
  mesa?: number | null;
  clienteNombre?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
  /** Valor de la carrera (solo DELIVERY); en otros canales se ignora. */
  envio?: Money;
  /** Ítems del carrito. Puede venir vacío (orden en blanco). */
  items: CrearOrdenItemInput[];
}

/**
 * Caso de uso `CrearOrdenConItems` (R4, R5.1, R8).
 *
 * Operación **transaccional** (Property 7): valida los datos requeridos por
 * canal, crea la orden en estado `ABIERTA`, y por cada ítem verifica
 * disponibilidad y decrementa el `stockDelDia` (con auto-86 al llegar a 0)
 * agregando el `OrderItem` con snapshot de nombre y precio. Recalcula totales y
 * persiste todo junto: o se crea la orden con su stock descontado, o no se
 * crea nada.
 *
 * Como el stock no se reserva plato por plato (a diferencia de
 * `AgregarItemAOrden`), si dos órdenes compiten por el último plato, la
 * segunda falla aquí con `MENU_ITEM_STOCK_INSUFICIENTE` y la transacción se
 * revierte sin dejar la orden a medias.
 */
export class CrearOrdenConItems {
  constructor(
    private readonly tx: TransactionRunner,
    private readonly ids: IdGenerator,
  ) {}

  async ejecutar(input: CrearOrdenConItemsInput): Promise<Result<Order>> {
    try {
      this.validarDatosDeCanal(input);

      const creada = await this.tx.run(async ({ orders, menu }) => {
        const order = Order.crear({
          id: this.ids.generate(),
          // El número real lo asigna la persistencia (autoincrement).
          numero: 0,
          canal: input.canal,
          creadoPorId: input.creadoPorId,
          mesa: input.canal === OrderChannel.SALON ? input.mesa ?? null : null,
          clienteNombre: input.clienteNombre ?? null,
          clienteDireccion: input.clienteDireccion ?? null,
          clienteTelefono: input.clienteTelefono ?? null,
        });

        // Registra la carrera antes de recalcular para reflejarla en el total.
        if (input.canal === OrderChannel.DELIVERY && input.envio) {
          order.establecerEnvio(input.envio);
        }

        for (const linea of input.items) {
          const plato = await menu.obtener(linea.menuItemId);
          if (!plato) {
            throw new DomainError(
              `No existe el plato ${linea.menuItemId}`,
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
          await menu.ajustarStock(linea.menuItemId, -linea.cantidad);

          order.agregarItem(
            OrderItem.crear({
              id: this.ids.generate(),
              menuItemId: plato.id,
              nombrePlato: plato.nombre,
              precioUnit: plato.precio,
              cantidad: linea.cantidad,
            }),
          );
        }

        order.recalcular();
        return orders.crear(order);
      });

      return ok(creada);
    } catch (error) {
      if (error instanceof DomainError) {
        return err(error);
      }
      throw error;
    }
  }

  /**
   * Reglas de datos requeridos por canal (R4.4, R4.5):
   * - `SALON` exige un número de mesa entero positivo.
   * - `DELIVERY` exige la dirección del cliente.
   */
  private validarDatosDeCanal(input: CrearOrdenConItemsInput): void {
    if (input.canal === OrderChannel.SALON) {
      if (input.mesa === undefined || input.mesa === null) {
        throw new DomainError(
          "Una orden de salón requiere el número de mesa",
          "ORDER_SALON_SIN_MESA",
        );
      }
      if (!Number.isInteger(input.mesa) || input.mesa <= 0) {
        throw new DomainError(
          "El número de mesa debe ser un entero positivo",
          "ORDER_MESA_INVALIDA",
        );
      }
    }

    if (input.canal === OrderChannel.DELIVERY) {
      const direccion = input.clienteDireccion?.trim();
      if (!direccion) {
        throw new DomainError(
          "Una orden de delivery requiere la dirección del cliente",
          "ORDER_DELIVERY_SIN_DIRECCION",
        );
      }
    }
  }
}
