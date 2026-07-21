import { Order } from "@/domain/order/Order";

/**
 * Puerto para la persistencia de órdenes.
 *
 * Abstrae el almacenamiento y recuperación de la entidad `Order`. La
 * implementación concreta (Prisma) vive en la capa de infraestructura.
 */
export interface OrderRepository {
  /** Persiste una orden nueva y retorna la entidad creada. */
  crear(order: Order): Promise<Order>;

  /** Obtiene una orden por su id, o `null` si no existe. */
  obtener(id: string): Promise<Order | null>;

  /** Retorna todas las órdenes activas (no terminales) para el KDS (R14). */
  activas(): Promise<Order[]>;

  /**
   * Retorna todas las órdenes en estado `COBRADA` pendientes de cierre.
   *
   * Las consume el cierre de la jornada (`CerrarCaja`) para transicionarlas a
   * `CERRADA` dentro de la misma transacción del cierre (R6.6).
   */
  cobradas(): Promise<Order[]>;

  /** Persiste los cambios de una orden existente. */
  guardar(order: Order): Promise<void>;
}
