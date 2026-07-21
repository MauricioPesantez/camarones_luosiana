import type { AuditRepository } from "./AuditRepository";
import type { CajaRepository } from "./CajaRepository";
import type { MenuRepository } from "./MenuRepository";
import type { OrderRepository } from "./OrderRepository";
import type { UserRepository } from "./UserRepository";

/**
 * Conjunto de repositorios atados a una misma transacción.
 *
 * Se expresa en términos de los puertos (no de las implementaciones Prisma),
 * de modo que los casos de uso permanezcan agnósticos a la infraestructura y
 * puedan probarse con fakes en memoria que implementen estos mismos puertos.
 */
export interface TransactionalRepositories {
  orders: OrderRepository;
  menu: MenuRepository;
  caja: CajaRepository;
  users: UserRepository;
  audit: AuditRepository;
}

/**
 * Puerto de unidad de trabajo: ejecuta `fn` dentro de una transacción y le
 * entrega un conjunto de repositorios transaccionales. Todas las escrituras
 * realizadas a través de esos repositorios se confirman juntas o se revierten
 * juntas (Property 7 del diseño: atomicidad de stock + orden + caja).
 *
 * La implementación concreta (Prisma `$transaction`) vive en infraestructura;
 * los tests pueden proveer un runner de paso directo (pass-through) sobre
 * repositorios fake.
 */
export interface TransactionRunner {
  run<T>(fn: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}
