import type { PrismaClient } from "@prisma/client";

import { PrismaClientLike } from "./client";
import { prisma } from "./prisma";
import { PrismaAuditRepository } from "./repositories/PrismaAuditRepository";
import { PrismaCajaRepository } from "./repositories/PrismaCajaRepository";
import { PrismaMenuRepository } from "./repositories/PrismaMenuRepository";
import { PrismaOrderRepository } from "./repositories/PrismaOrderRepository";
import { PrismaUserRepository } from "./repositories/PrismaUserRepository";

/**
 * Conjunto de repositorios ligados a un mismo cliente Prisma.
 *
 * Cuando se construyen con un cliente transaccional (dentro de
 * `runInTransaction`), todas sus operaciones comparten la misma transacción,
 * lo que permite operaciones atómicas que tocan orden + stock + caja a la vez.
 */
export interface UnitOfWork {
  orders: PrismaOrderRepository;
  menu: PrismaMenuRepository;
  caja: PrismaCajaRepository;
  users: PrismaUserRepository;
  audit: PrismaAuditRepository;
}

/** Construye los repositorios atados al cliente Prisma indicado. */
export function buildRepositories(db: PrismaClientLike): UnitOfWork {
  return {
    orders: new PrismaOrderRepository(db),
    menu: new PrismaMenuRepository(db),
    caja: new PrismaCajaRepository(db),
    users: new PrismaUserRepository(db),
    audit: new PrismaAuditRepository(db),
  };
}

/**
 * Patrón de unidad de trabajo: ejecuta `fn` dentro de una transacción Prisma,
 * exponiendo un conjunto de repositorios atados al cliente transaccional.
 *
 * Todas las escrituras realizadas a través de los repositorios recibidos se
 * confirman juntas o se revierten juntas. Es el mecanismo que usan los casos de
 * uso `AgregarItemAOrden`/`QuitarItem` (tarea 13.2) y `CobrarOrden` (tarea 14)
 * para garantizar la atomicidad del dinero y el stock (Property 7).
 *
 * @example
 * await runInTransaction(async ({ orders, menu, caja }) => {
 *   await menu.ajustarStock(menuItemId, -cantidad);
 *   await orders.guardar(order);
 *   await caja.agregarMovimiento(movimiento);
 * });
 */
export async function runInTransaction<T>(
  fn: (repos: UnitOfWork) => Promise<T>,
  client: PrismaClient = prisma,
): Promise<T> {
  return client.$transaction((tx) => fn(buildRepositories(tx)));
}
