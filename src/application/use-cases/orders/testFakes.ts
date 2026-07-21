import type { AuditFiltro } from "@/application/ports/AuditRepository";
import type { AuditRepository } from "@/application/ports/AuditRepository";
import type { CajaRepository } from "@/application/ports/CajaRepository";
import type { Clock } from "@/application/ports/Clock";
import type { IdGenerator } from "@/application/ports/IdGenerator";
import type { MenuRepository } from "@/application/ports/MenuRepository";
import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { RealtimeNotifier } from "@/application/ports/RealtimeNotifier";
import type { StorageService } from "@/application/ports/StorageService";
import type {
  TransactionRunner,
  TransactionalRepositories,
} from "@/application/ports/TransactionRunner";
import type { UserRepository } from "@/application/ports/UserRepository";
import { AuditEntry } from "@/domain/audit/AuditEntry";
import { MenuItem } from "@/domain/menu/MenuItem";
import { Order } from "@/domain/order/Order";
import { OrderStatus } from "@/domain/order/OrderStatus";

/**
 * Repositorios y facades en memoria compartidos por las pruebas de los casos de
 * uso de órdenes. No usan DB ni mocks de librerías: implementan los puertos con
 * estructuras de datos simples para validar la lógica real de los casos de uso.
 */

/** Repositorio de órdenes en memoria. */
export class FakeOrderRepository implements OrderRepository {
  readonly store = new Map<string, Order>();

  agregar(order: Order): void {
    this.store.set(order.id, order);
  }

  async crear(order: Order): Promise<Order> {
    this.store.set(order.id, order);
    return order;
  }

  async obtener(id: string): Promise<Order | null> {
    return this.store.get(id) ?? null;
  }

  async activas(): Promise<Order[]> {
    return [...this.store.values()].filter(
      (o) =>
        o.estado !== OrderStatus.CERRADA && o.estado !== OrderStatus.CANCELADA,
    );
  }

  async cobradas(): Promise<Order[]> {
    return [...this.store.values()].filter(
      (o) => o.estado === OrderStatus.COBRADA,
    );
  }

  async guardar(order: Order): Promise<void> {
    this.store.set(order.id, order);
  }
}

/** Repositorio de menú en memoria con `ajustarStock` que aplica auto-86. */
export class FakeMenuRepository implements MenuRepository {
  readonly store = new Map<string, MenuItem>();

  agregar(item: MenuItem): void {
    this.store.set(item.id, item);
  }

  async listar(): Promise<MenuItem[]> {
    return [...this.store.values()];
  }

  async obtener(id: string): Promise<MenuItem | null> {
    return this.store.get(id) ?? null;
  }

  async guardar(item: MenuItem): Promise<void> {
    this.store.set(item.id, item);
  }

  async eliminar(id: string): Promise<void> {
    this.store.delete(id);
  }

  async ajustarStock(id: string, delta: number): Promise<MenuItem> {
    const item = this.store.get(id);
    if (!item) {
      throw new Error(`FakeMenuRepository: no existe el plato ${id}`);
    }
    if (delta < 0) {
      item.decrementar(-delta);
    } else if (delta > 0) {
      item.incrementar(delta);
    }
    return item;
  }
}

/** Repositorio de auditoría en memoria. */
export class FakeAuditRepository implements AuditRepository {
  readonly entries: AuditEntry[] = [];

  async registrar(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }

  async listar(_filtro?: AuditFiltro): Promise<AuditEntry[]> {
    return [...this.entries];
  }
}

/** Notificador de realtime que registra los canales notificados. */
export class FakeRealtimeNotifier implements RealtimeNotifier {
  readonly notificados: string[] = [];

  async notificarCambio(canal: string): Promise<void> {
    this.notificados.push(canal);
  }
}

/** Generador de ids determinista para pruebas. */
export class FakeIdGenerator implements IdGenerator {
  private contador = 0;

  constructor(private readonly prefijo = "id") {}

  generate(): string {
    this.contador += 1;
    return `${this.prefijo}-${this.contador}`;
  }
}

/** Reloj fijo para pruebas. */
export class FakeClock implements Clock {
  constructor(private readonly fecha = new Date("2026-01-01T12:00:00.000Z")) {}

  now(): Date {
    return this.fecha;
  }
}

/** Stub que lanza si se usa: cubre puertos no relevantes para una prueba. */
function repoNoUsado<T extends object>(nombre: string): T {
  return new Proxy({} as T, {
    get() {
      throw new Error(`${nombre} no debería usarse en esta prueba`);
    },
  });
}

/**
 * `TransactionRunner` de paso directo (pass-through) para pruebas: ejecuta la
 * función con los repositorios en memoria sin abrir una transacción real. La
 * atomicidad se prueba con la implementación Prisma en otro nivel; aquí se
 * valida la lógica del caso de uso.
 */
export class FakeTransactionRunner implements TransactionRunner {
  constructor(
    private readonly orders: OrderRepository,
    private readonly menu: MenuRepository,
    private readonly audit: AuditRepository = new FakeAuditRepository(),
    private readonly caja?: CajaRepository,
  ) {}

  run<T>(fn: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    const repos: TransactionalRepositories = {
      orders: this.orders,
      menu: this.menu,
      audit: this.audit,
      caja: this.caja ?? repoNoUsado<CajaRepository>("CajaRepository"),
      users: repoNoUsado<UserRepository>("UserRepository"),
    };
    return fn(repos);
  }
}

/**
 * `StorageService` en memoria para pruebas de cobro por transferencia. Registra
 * las subidas realizadas y devuelve una URL determinista basada en el orderId,
 * sin tocar S3.
 */
export class FakeStorageService implements StorageService {
  readonly subidas: { orderId: string; mime: string }[] = [];

  async subirComprobante(
    orderId: string,
    _archivo: Buffer,
    mime: string,
  ): Promise<string> {
    this.subidas.push({ orderId, mime });
    return `https://storage.test/comprobantes/${orderId}`;
  }
}
