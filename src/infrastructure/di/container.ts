/**
 * Contenedor de inyección de dependencias (ADR-001).
 *
 * Ensambla las implementaciones concretas de infraestructura y las expone como
 * singletons. Los route handlers / server actions piden aquí los facades y
 * (en el futuro) los casos de uso; nunca instancian repositorios o SDKs
 * directamente. Esto preserva la regla de dependencia (presentation → application
 * → domain) y facilita sustituir implementaciones por fakes en tests.
 *
 * Estado de implementación:
 * - Facades (Auth, Storage, Realtime, Clock): implementados y cableados aquí.
 * - Repositorios Prisma (tarea 9): cableados aquí mediante el cliente `prisma`.
 * - Casos de uso (tareas 11-16): su composición se añadirá a medida que se
 *   implementen, reutilizando estos getters.
 */
import type {
  AuditRepository,
  CajaRepository,
  MenuRepository,
  OrderRepository,
  UserRepository,
} from "@/application/ports";
import type { AuthService } from "@/application/ports/AuthService";
import type { Clock } from "@/application/ports/Clock";
import type { IdGenerator } from "@/application/ports/IdGenerator";
import type { RealtimeNotifier } from "@/application/ports/RealtimeNotifier";
import type { StorageService } from "@/application/ports/StorageService";
import type { TransactionRunner } from "@/application/ports/TransactionRunner";

import { JwtAuthService } from "@/infrastructure/auth/JwtAuthService";
import { SystemClock } from "@/infrastructure/clock/SystemClock";
import { prisma } from "@/infrastructure/db/prisma";
import { PrismaTransactionRunner } from "@/infrastructure/db/PrismaTransactionRunner";
import {
  PrismaAuditRepository,
  PrismaCajaRepository,
  PrismaMenuRepository,
  PrismaOrderRepository,
  PrismaUserRepository,
} from "@/infrastructure/db/repositories";
import { UuidGenerator } from "@/infrastructure/id/UuidGenerator";
import { PollingNotifier } from "@/infrastructure/realtime/PollingNotifier";
import { S3StorageService } from "@/infrastructure/storage/S3StorageService";

import { AjustarStock } from "@/application/use-cases/menu/AjustarStock";
import { GestionarMenu } from "@/application/use-cases/menu/GestionarMenu";

import { GestionarUsuarios } from "@/application/use-cases/auth/GestionarUsuarios";
import { Login } from "@/application/use-cases/auth/Login";

import { AbrirCaja } from "@/application/use-cases/caja/AbrirCaja";
import { CerrarCaja } from "@/application/use-cases/caja/CerrarCaja";
import { IngresoRetiroManual } from "@/application/use-cases/caja/IngresoRetiroManual";
import { RegistrarCompraMenor } from "@/application/use-cases/caja/RegistrarCompraMenor";
import { RegistrarPagoProveedor } from "@/application/use-cases/caja/RegistrarPagoProveedor";

import { AgregarItemAOrden } from "@/application/use-cases/orders/AgregarItemAOrden";
import { CancelarOrden } from "@/application/use-cases/orders/CancelarOrden";
import { CobrarOrden } from "@/application/use-cases/orders/CobrarOrden";
import { CrearOrden } from "@/application/use-cases/orders/CrearOrden";
import { CrearOrdenConItems } from "@/application/use-cases/orders/CrearOrdenConItems";
import { EnviarACocina } from "@/application/use-cases/orders/EnviarACocina";
import { EntregarOrden } from "@/application/use-cases/orders/EntregarOrden";
import { IniciarPreparacion } from "@/application/use-cases/orders/IniciarPreparacion";
import { MarcarOrdenLista } from "@/application/use-cases/orders/MarcarOrdenLista";
import { QuitarItem } from "@/application/use-cases/orders/QuitarItem";

// ---------------------------------------------------------------------------
// Facades (singletons)
// ---------------------------------------------------------------------------

let _authService: AuthService | undefined;
let _storageService: StorageService | undefined;
let _realtimeNotifier: RealtimeNotifier | undefined;
let _clock: Clock | undefined;
let _idGenerator: IdGenerator | undefined;
let _transactionRunner: TransactionRunner | undefined;

/** Facade de autenticación (JWT + bcrypt). */
export function getAuthService(): AuthService {
  if (!_authService) {
    _authService = new JwtAuthService();
  }
  return _authService;
}

/** Facade de almacenamiento de comprobantes (S3). */
export function getStorageService(): StorageService {
  if (!_storageService) {
    _storageService = new S3StorageService();
  }
  return _storageService;
}

/** Facade de notificaciones en tiempo real (polling). */
export function getRealtimeNotifier(): RealtimeNotifier {
  if (!_realtimeNotifier) {
    _realtimeNotifier = new PollingNotifier();
  }
  return _realtimeNotifier;
}

/** Facade de reloj del sistema. */
export function getClock(): Clock {
  if (!_clock) {
    _clock = new SystemClock();
  }
  return _clock;
}

/** Facade de generación de identificadores únicos. */
export function getIdGenerator(): IdGenerator {
  if (!_idGenerator) {
    _idGenerator = new UuidGenerator();
  }
  return _idGenerator;
}

/** Unidad de trabajo / runner de transacciones (Prisma). */
export function getTransactionRunner(): TransactionRunner {
  if (!_transactionRunner) {
    _transactionRunner = new PrismaTransactionRunner(prisma);
  }
  return _transactionRunner;
}

// ---------------------------------------------------------------------------
// Repositorios (singletons) — Prisma (tarea 9)
// ---------------------------------------------------------------------------
//
// Cada repositorio recibe el cliente `prisma` singleton. Acepta también un
// cliente transaccional cuando se invoca dentro de `runInTransaction`, pero el
// contenedor inyecta el singleton por defecto.

let _orderRepository: OrderRepository | undefined;
let _menuRepository: MenuRepository | undefined;
let _cajaRepository: CajaRepository | undefined;
let _userRepository: UserRepository | undefined;
let _auditRepository: AuditRepository | undefined;

/** Repositorio de órdenes (Prisma). */
export function getOrderRepository(): OrderRepository {
  if (!_orderRepository) {
    _orderRepository = new PrismaOrderRepository(prisma);
  }
  return _orderRepository;
}

/** Repositorio de menú (Prisma). */
export function getMenuRepository(): MenuRepository {
  if (!_menuRepository) {
    _menuRepository = new PrismaMenuRepository(prisma);
  }
  return _menuRepository;
}

/** Repositorio de caja (Prisma). */
export function getCajaRepository(): CajaRepository {
  if (!_cajaRepository) {
    _cajaRepository = new PrismaCajaRepository(prisma);
  }
  return _cajaRepository;
}

/** Repositorio de usuarios (Prisma). */
export function getUserRepository(): UserRepository {
  if (!_userRepository) {
    _userRepository = new PrismaUserRepository(prisma);
  }
  return _userRepository;
}

/** Repositorio de auditoría (Prisma). */
export function getAuditRepository(): AuditRepository {
  if (!_auditRepository) {
    _auditRepository = new PrismaAuditRepository(prisma);
  }
  return _auditRepository;
}

// ---------------------------------------------------------------------------
// Casos de uso — autenticación y usuarios (tarea 11)
// ---------------------------------------------------------------------------
//
// Los casos de uso se componen bajo demanda reutilizando los getters de
// repositorios y facades. No se memoizan: son objetos livianos y sin estado.

/** Caso de uso de inicio de sesión (R1). */
export function getLogin(): Login {
  return new Login(getUserRepository(), getAuthService());
}

/** Caso de uso de gestión de usuarios, roles y permisos (R2). */
export function getGestionarUsuarios(): GestionarUsuarios {
  return new GestionarUsuarios(getUserRepository(), getAuthService());
}

// ---------------------------------------------------------------------------
// Casos de uso — menú (tarea 12)
// ---------------------------------------------------------------------------

/** Caso de uso de gestión del menú (CRUD de platos, R3.1). */
export function getGestionarMenu(): GestionarMenu {
  return new GestionarMenu(getMenuRepository());
}

/** Caso de uso de ajuste de stock y disponibilidad (R3.6, R3.7). */
export function getAjustarStock(): AjustarStock {
  return new AjustarStock(getMenuRepository());
}

// ---------------------------------------------------------------------------
// Casos de uso — órdenes (tarea 13)
// ---------------------------------------------------------------------------

/** Caso de uso de creación de órdenes con validación por canal (R4). */
export function getCrearOrden(): CrearOrden {
  return new CrearOrden(getOrderRepository(), getIdGenerator());
}

/**
 * Caso de uso de creación de orden con sus ítems en una sola operación
 * transaccional (R4, R5.1): valida el canal, descuenta el stock de cada ítem y
 * persiste la orden `ABIERTA` completa. Lo usa la pantalla de toma de orden que
 * arma el carrito en memoria y crea al final.
 */
export function getCrearOrdenConItems(): CrearOrdenConItems {
  return new CrearOrdenConItems(getTransactionRunner(), getIdGenerator());
}

/** Caso de uso de agregar ítem (transaccional: stock + auto-86, R3.3/R5). */
export function getAgregarItemAOrden(): AgregarItemAOrden {
  return new AgregarItemAOrden(getTransactionRunner(), getIdGenerator());
}

/** Caso de uso de quitar ítem (transaccional: restaura stock, R5.1/R5.2). */
export function getQuitarItem(): QuitarItem {
  return new QuitarItem(getTransactionRunner());
}

/** Caso de uso de envío a cocina (R6.1, notifica al KDS). */
export function getEnviarACocina(): EnviarACocina {
  return new EnviarACocina(getOrderRepository(), getRealtimeNotifier());
}

/** Caso de uso de inicio de preparación (R6.2, notifica al KDS). */
export function getIniciarPreparacion(): IniciarPreparacion {
  return new IniciarPreparacion(getOrderRepository(), getRealtimeNotifier());
}

/** Caso de uso de entrega de orden (R6.4). */
export function getEntregarOrden(): EntregarOrden {
  return new EntregarOrden(getOrderRepository(), getRealtimeNotifier());
}

/** Caso de uso de cancelación de orden (R6.8, R7, R16: admin + auditoría). */
export function getCancelarOrden(): CancelarOrden {
  return new CancelarOrden(getTransactionRunner(), getIdGenerator(), getClock());
}

// ---------------------------------------------------------------------------
// Caso de uso — cobro (tarea 14)
// ---------------------------------------------------------------------------

/**
 * Caso de uso de cobro (R9, R11, R12): transaccional (movimientos + estado),
 * exige `puedeCobrar` y comprobante en transferencia.
 */
export function getCobrarOrden(): CobrarOrden {
  return new CobrarOrden(
    getTransactionRunner(),
    getStorageService(),
    getIdGenerator(),
    getClock(),
  );
}

// ---------------------------------------------------------------------------
// Casos de uso — caja (tarea 15)
// ---------------------------------------------------------------------------
//
// Los casos de uso de caja existentes reciben un generador de ids con la firma
// `() => string`; aquí se adapta el puerto `IdGenerator` reutilizando el getter
// compartido para no duplicar la fuente de ids.

/** Adapta el `IdGenerator` (puerto) a la firma `() => string` de caja. */
function cajaIdGen(): string {
  return getIdGenerator().generate();
}

/** Caso de uso de apertura de caja (R10: solo admin, movimiento APERTURA). */
export function getAbrirCaja(): AbrirCaja {
  return new AbrirCaja(getCajaRepository(), getClock(), cajaIdGen);
}

/** Caso de uso de registro de pago a proveedor (R11.3: −, EFECTIVO). */
export function getRegistrarPagoProveedor(): RegistrarPagoProveedor {
  return new RegistrarPagoProveedor(getCajaRepository(), getClock(), cajaIdGen);
}

/** Caso de uso de registro de compra menor (R11.4: −, EFECTIVO). */
export function getRegistrarCompraMenor(): RegistrarCompraMenor {
  return new RegistrarCompraMenor(getCajaRepository(), getClock(), cajaIdGen);
}

/** Caso de uso de ingreso/retiro manual de efectivo (R11.5, R11.6). */
export function getIngresoRetiroManual(): IngresoRetiroManual {
  return new IngresoRetiroManual(getCajaRepository(), getClock(), cajaIdGen);
}

/**
 * Caso de uso de cierre de caja (R13: cuadre, solo admin, auditoría; R6.6:
 * cierra las órdenes `COBRADA` de la jornada). Transaccional: el cuadre, el
 * cierre de la sesión, el cierre de órdenes y la auditoría se confirman juntos.
 */
export function getCerrarCaja(): CerrarCaja {
  return new CerrarCaja(getTransactionRunner(), getClock(), cajaIdGen);
}

// ---------------------------------------------------------------------------
// Caso de uso — cocina (tarea 16)
// ---------------------------------------------------------------------------

/** Caso de uso de marcar orden lista (R6.3, R15.1: notifica al KDS). */
export function getMarcarOrdenLista(): MarcarOrdenLista {
  return new MarcarOrdenLista(getOrderRepository(), getRealtimeNotifier());
}
