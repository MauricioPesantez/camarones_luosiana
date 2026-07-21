import { OrderRepository } from "@/application/ports/OrderRepository";
import { Order } from "@/domain/order/Order";
import { OrderStatus } from "@/domain/order/OrderStatus";

import { PrismaClientLike } from "../client";
import { moneyToDecimal, toOrderDomain } from "../mappers";
import { prisma } from "../prisma";

/** Estados terminales: no se consideran "activos" para el KDS (R14). */
const ESTADOS_TERMINALES: OrderStatus[] = [
  OrderStatus.CERRADA,
  OrderStatus.CANCELADA,
];

/**
 * Implementación Prisma del puerto `OrderRepository`.
 *
 * Acepta un cliente Prisma (singleton o transaccional) para poder participar
 * en una unidad de trabajo (`runInTransaction`) cuando una operación toca
 * orden + stock + caja a la vez (R11.1, R11.2; ver tareas 13.2 y 14).
 */
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly db: PrismaClientLike = prisma) {}

  /**
   * Persiste una orden nueva junto con sus ítems en una sola escritura anidada
   * (atómica). El `numero` lo asigna la base de datos (`autoincrement`), por lo
   * que se ignora el valor del agregado entrante y se retorna la orden
   * reconstituida con el número real asignado.
   */
  async crear(order: Order): Promise<Order> {
    const row = await this.db.order.create({
      data: {
        id: order.id,
        canal: order.canal,
        estado: order.estado,
        mesa: order.mesa,
        clienteNombre: order.clienteNombre,
        clienteDireccion: order.clienteDireccion,
        clienteTelefono: order.clienteTelefono,
        envio: moneyToDecimal(order.envio),
        envases: moneyToDecimal(order.envases),
        subtotal: moneyToDecimal(order.subtotal),
        total: moneyToDecimal(order.total),
        creadoPorId: order.creadoPorId,
        items: {
          create: order.items.map((it) => ({
            id: it.id,
            menuItemId: it.menuItemId,
            nombrePlato: it.nombrePlato,
            precioUnit: moneyToDecimal(it.precioUnit),
            cantidad: it.cantidad,
          })),
        },
      },
      include: { items: true },
    });
    return toOrderDomain(row);
  }

  async obtener(id: string): Promise<Order | null> {
    const row = await this.db.order.findUnique({
      where: { id },
      include: { items: true },
    });
    return row ? toOrderDomain(row) : null;
  }

  async activas(): Promise<Order[]> {
    const rows = await this.db.order.findMany({
      where: { estado: { notIn: ESTADOS_TERMINALES } },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toOrderDomain);
  }

  /**
   * Retorna las órdenes en estado `COBRADA` que quedan pendientes de cierre.
   * El cierre de la jornada (`CerrarCaja`) las transiciona a `CERRADA` dentro
   * de la misma transacción (R6.6).
   */
  async cobradas(): Promise<Order[]> {
    const rows = await this.db.order.findMany({
      where: { estado: OrderStatus.COBRADA },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toOrderDomain);
  }

  /**
   * Persiste los cambios de una orden existente: campos escalares e ítems.
   *
   * Los ítems se sincronizan eliminando los que ya no están en el agregado y
   * haciendo `upsert` del resto, de modo que agregar/quitar ítems (running tab)
   * se refleje fielmente. Cuando este método corre dentro de `runInTransaction`
   * todas las escrituras son atómicas.
   */
  async guardar(order: Order): Promise<void> {
    const idsActuales = order.items.map((it) => it.id);

    // Elimina los ítems que ya no pertenecen a la orden.
    await this.db.orderItem.deleteMany({
      where: { orderId: order.id, id: { notIn: idsActuales } },
    });

    // Inserta o actualiza cada ítem vigente.
    for (const it of order.items) {
      await this.db.orderItem.upsert({
        where: { id: it.id },
        create: {
          id: it.id,
          orderId: order.id,
          menuItemId: it.menuItemId,
          nombrePlato: it.nombrePlato,
          precioUnit: moneyToDecimal(it.precioUnit),
          cantidad: it.cantidad,
        },
        update: {
          nombrePlato: it.nombrePlato,
          precioUnit: moneyToDecimal(it.precioUnit),
          cantidad: it.cantidad,
        },
      });
    }

    await this.db.order.update({
      where: { id: order.id },
      data: {
        canal: order.canal,
        estado: order.estado,
        mesa: order.mesa,
        clienteNombre: order.clienteNombre,
        clienteDireccion: order.clienteDireccion,
        clienteTelefono: order.clienteTelefono,
        envio: moneyToDecimal(order.envio),
        envases: moneyToDecimal(order.envases),
        subtotal: moneyToDecimal(order.subtotal),
        total: moneyToDecimal(order.total),
        metodoPago: order.metodoPago,
        comprobanteUrl: order.comprobanteUrl,
      },
    });
  }
}
