import type { SessionUser } from "@/application/ports/AuthService";
import type { Clock } from "@/application/ports/Clock";
import type { IdGenerator } from "@/application/ports/IdGenerator";
import type { StorageService } from "@/application/ports/StorageService";
import type { TransactionRunner } from "@/application/ports/TransactionRunner";
import { Libro } from "@/domain/caja/Libro";
import { MovimientoCaja } from "@/domain/caja/MovimientoCaja";
import { TipoMovimiento } from "@/domain/caja/TipoMovimiento";
import { MetodoPago } from "@/domain/order/MetodoPago";
import { Order } from "@/domain/order/Order";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";

/** Comprobante de transferencia a subir (obligatorio en `TRANSFERENCIA`, R9.3). */
export interface ComprobanteInput {
  /** Contenido del archivo en buffer. */
  archivo: Buffer;
  /** Tipo MIME del archivo (e.g., "image/jpeg"). */
  mime: string;
}

/** Datos de entrada para cobrar una orden. */
export interface CobrarOrdenInput {
  orderId: string;
  /** Usuario que registra el cobro (de la sesión verificada). */
  actor: SessionUser;
  /** Método de pago: `EFECTIVO` o `TRANSFERENCIA` (R9.1). */
  metodoPago: MetodoPago;
  /** Comprobante de transferencia; obligatorio si `metodoPago` es `TRANSFERENCIA` (R9.3). */
  comprobante?: ComprobanteInput | null;
}

/**
 * Caso de uso `CobrarOrden` (R2.3, R2.4, R9.1, R9.2, R9.3, R11.1, R11.2,
 * R12.1, R12.2, R12.3).
 *
 * El núcleo del dinero. Operación **transaccional** (Property 7): genera los
 * movimientos de caja y transiciona la orden a `COBRADA` en una sola unidad de
 * trabajo, o no hace nada. No existe una orden cobrada sin sus movimientos, ni
 * movimientos de venta sin orden cobrada.
 *
 * Flujo:
 * 1. Autorización en profundidad: exige `puedeCobrar` en el actor (R2.3, R2.4).
 * 2. Carga la orden y valida idempotencia (no recobra una orden ya `COBRADA`) y
 *    estado (`ENTREGADA`, R9.2).
 * 3. Exige una `CajaSession` abierta (los movimientos solo existen dentro de
 *    una jornada).
 * 4. En `TRANSFERENCIA` exige y sube el comprobante vía `StorageService`
 *    (R9.3).
 * 5. Asienta los `MovimientoCaja` según el escenario de caja (R11.1, R11.2,
 *    R12.1, R12.2, R12.3).
 * 6. Registra el cobro en la orden (método de pago, comprobante) y la pasa a
 *    `COBRADA` (R9.2).
 *
 * Escenarios de caja:
 * - EFECTIVO salón/retirar: `VENTA_EFECTIVO +total` (EFECTIVO) — R11.1.
 * - TRANSFERENCIA salón/retirar: `VENTA_TRANSFERENCIA +total` (TRANSFERENCIA) — R11.2.
 * - DELIVERY + TRANSFERENCIA: `VENTA_TRANSFERENCIA +total` (TRANSFERENCIA) **y**
 *   `PAGO_CARRERA −envio` (EFECTIVO, `esCarreraPassthrough=true`) — R12.1, R12.2.
 * - DELIVERY + EFECTIVO: `VENTA_EFECTIVO +(subtotal+envases)` (EFECTIVO); la
 *   carrera no toca la caja — R12.3.
 */
export class CobrarOrden {
  constructor(
    private readonly tx: TransactionRunner,
    private readonly storage: StorageService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async ejecutar(input: CobrarOrdenInput): Promise<Result<Order>> {
    // R2.3, R2.4: solo un usuario con el permiso de cobro puede registrar cobros.
    if (!input.actor.puedeCobrar) {
      return err(
        new DomainError(
          "El usuario no tiene permiso para registrar cobros",
          "COBRO_NO_AUTORIZADO",
        ),
      );
    }

    try {
      const order = await this.tx.run(async ({ orders, caja }) => {
        const order = await orders.obtener(input.orderId);
        if (!order) {
          throw new DomainError(
            `No existe la orden ${input.orderId}`,
            "ORDER_NO_ENCONTRADA",
          );
        }

        // Idempotencia: una orden ya cobrada no se vuelve a cobrar (no se
        // duplican movimientos). Se valida antes de tocar la caja.
        if (order.estado === OrderStatus.COBRADA) {
          throw new DomainError(
            `La orden ${input.orderId} ya fue cobrada`,
            "ORDER_YA_COBRADA",
          );
        }

        // R9.2: solo se cobra una orden entregada.
        if (order.estado !== OrderStatus.ENTREGADA) {
          throw new DomainError(
            `Solo se puede cobrar una orden en estado ENTREGADA (actual: ${order.estado})`,
            "ORDER_NO_ENTREGADA",
          );
        }

        // Los movimientos solo existen dentro de una jornada abierta.
        const sesion = await caja.sesionAbierta();
        if (!sesion) {
          throw new DomainError(
            "No hay una sesión de caja abierta",
            "CAJA_NO_ABIERTA",
          );
        }

        // R9.3: la transferencia exige comprobante; se sube y se asocia a la orden.
        let comprobanteUrl: string | null = null;
        if (input.metodoPago === MetodoPago.TRANSFERENCIA) {
          if (!input.comprobante) {
            throw new DomainError(
              "El cobro por transferencia requiere un comprobante",
              "COMPROBANTE_REQUERIDO",
            );
          }
          comprobanteUrl = await this.storage.subirComprobante(
            order.id,
            input.comprobante.archivo,
            input.comprobante.mime,
          );
        }

        // Genera los movimientos de caja del escenario (R11.1, R11.2, R12.*).
        const movimientos = this.movimientosDeCobro(
          order,
          input.metodoPago,
          sesion.id,
          input.actor.id,
        );
        for (const movimiento of movimientos) {
          await caja.agregarMovimiento(movimiento);
        }

        // R9.2, R6.5: registra el cobro y transiciona a COBRADA.
        order.registrarCobro(input.metodoPago, comprobanteUrl);
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

  /**
   * Construye los `MovimientoCaja` correspondientes al escenario de cobro
   * (R11.1, R11.2, R12.1, R12.2, R12.3). Devuelve uno o dos movimientos según
   * el canal y el método de pago.
   */
  private movimientosDeCobro(
    order: Order,
    metodoPago: MetodoPago,
    sesionId: string,
    empleadoId: string,
  ): MovimientoCaja[] {
    const timestamp = this.clock.now();
    const esDelivery = order.canal === OrderChannel.DELIVERY;

    if (metodoPago === MetodoPago.EFECTIVO) {
      // DELIVERY + EFECTIVO: la carrera (envío) la cobra el repartidor y no
      // entra a la caja; solo ingresa subtotal + envases (R12.3). En salón /
      // retirar el total ya no incluye envío, por lo que coincide con el total.
      const monto = esDelivery
        ? order.subtotal.suma(order.envases)
        : order.total;

      return [
        MovimientoCaja.crear({
          id: this.ids.generate(),
          sesionId,
          tipo: TipoMovimiento.VENTA_EFECTIVO,
          libro: Libro.EFECTIVO,
          monto,
          orderId: order.id,
          empleadoId,
          timestamp,
        }),
      ];
    }

    // TRANSFERENCIA: la venta entra completa al libro TRANSFERENCIA por el
    // total (R11.2, R12.1).
    const movimientos: MovimientoCaja[] = [
      MovimientoCaja.crear({
        id: this.ids.generate(),
        sesionId,
        tipo: TipoMovimiento.VENTA_TRANSFERENCIA,
        libro: Libro.TRANSFERENCIA,
        monto: order.total,
        orderId: order.id,
        empleadoId,
        timestamp,
      }),
    ];

    // DELIVERY + TRANSFERENCIA (passthrough): la carrera se pagó en efectivo de
    // la caja aunque la venta fue por transferencia, así que se asienta un
    // PAGO_CARRERA negativo en EFECTIVO por el envío (R12.2, Property 6).
    if (esDelivery) {
      movimientos.push(
        MovimientoCaja.crear({
          id: this.ids.generate(),
          sesionId,
          tipo: TipoMovimiento.PAGO_CARRERA,
          libro: Libro.EFECTIVO,
          monto: order.envio.negativo(),
          orderId: order.id,
          esCarreraPassthrough: true,
          empleadoId,
          timestamp,
        }),
      );
    }

    return movimientos;
  }
}
