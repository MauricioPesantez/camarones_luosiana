import type { IdGenerator } from "@/application/ports/IdGenerator";
import type { OrderRepository } from "@/application/ports/OrderRepository";
import { Money } from "@/domain/order/Money";
import { Order } from "@/domain/order/Order";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";

/**
 * Datos de entrada para crear una orden (R4).
 *
 * Según el canal se exigen datos distintos: `SALON` requiere número de mesa,
 * `DELIVERY` requiere la dirección del cliente. El `envio` (carrera) solo
 * aplica a `DELIVERY` y es opcional al crear.
 */
export interface CrearOrdenInput {
  canal: OrderChannel;
  creadoPorId: string;
  mesa?: number | null;
  clienteNombre?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
  /** Valor de la carrera (solo DELIVERY); en otros canales se ignora. */
  envio?: Money;
}

/**
 * Caso de uso `CrearOrden` (R4.1–R4.5).
 *
 * Valida que el canal traiga los datos requeridos y crea la orden en estado
 * `ABIERTA`. El `numero` visible lo asigna la base de datos al persistir
 * (autoincrement); aquí se usa un placeholder que el repositorio ignora.
 */
export class CrearOrden {
  constructor(
    private readonly orders: OrderRepository,
    private readonly ids: IdGenerator,
  ) {}

  async ejecutar(input: CrearOrdenInput): Promise<Result<Order>> {
    try {
      this.validarDatosDeCanal(input);

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
      order.recalcular();

      const creada = await this.orders.crear(order);
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
   * - `SALON` exige un número de mesa entero.
   * - `DELIVERY` exige la dirección del cliente.
   */
  private validarDatosDeCanal(input: CrearOrdenInput): void {
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
