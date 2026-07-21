import { Prisma } from "@prisma/client";
import type {
  AuditEntry as AuditEntryRow,
  CajaSession as CajaSessionRow,
  Category as CategoryRow,
  MenuItem as MenuItemRow,
  MovimientoCaja as MovimientoCajaRow,
  Order as OrderRow,
  OrderItem as OrderItemRow,
  User as UserRow,
} from "@prisma/client";

import { AuditEntry } from "@/domain/audit/AuditEntry";
import { CajaEstado } from "@/domain/caja/CajaEstado";
import { CajaSession } from "@/domain/caja/CajaSession";
import { Libro } from "@/domain/caja/Libro";
import { MovimientoCaja } from "@/domain/caja/MovimientoCaja";
import { TipoMovimiento } from "@/domain/caja/TipoMovimiento";
import { Category } from "@/domain/menu/Category";
import { MenuItem } from "@/domain/menu/MenuItem";
import { MetodoPago } from "@/domain/order/MetodoPago";
import { Money } from "@/domain/order/Money";
import { Order } from "@/domain/order/Order";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderItem } from "@/domain/order/OrderItem";
import { OrderStatus } from "@/domain/order/OrderStatus";
import { Role } from "@/domain/user/Role";
import { User } from "@/domain/user/User";

/* -------------------------------------------------------------------------- */
/*  Money <-> Prisma.Decimal                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Convierte un `Decimal` de Prisma al value object `Money` del dominio.
 * `Money.de` redondea al centavo, de modo que cualquier `Decimal(10,2)` se
 * representa de forma exacta en centavos enteros.
 */
export function decimalToMoney(value: Prisma.Decimal): Money {
  return Money.de(value.toNumber());
}

/** Igual que `decimalToMoney` pero tolera columnas `Decimal?` (nullable). */
export function decimalToMoneyOrNull(
  value: Prisma.Decimal | null,
): Money | null {
  return value === null ? null : decimalToMoney(value);
}

/**
 * Convierte un `Money` del dominio a un valor apto para una columna
 * `Decimal(10,2)` de Prisma. Se serializa como string con dos decimales
 * (p. ej. `"0.50"`, `"-1.25"`) para preservar la exactitud al persistir.
 */
export function moneyToDecimal(money: Money): string {
  return money.toString();
}

/** Igual que `moneyToDecimal` pero tolera valores nulos (columnas `Decimal?`). */
export function moneyToDecimalOrNull(money: Money | null): string | null {
  return money === null ? null : moneyToDecimal(money);
}

/* -------------------------------------------------------------------------- */
/*  Menú                                                                       */
/* -------------------------------------------------------------------------- */

export function toCategoryDomain(row: CategoryRow): Category {
  return Category.crear({ id: row.id, nombre: row.nombre });
}

export function toMenuItemDomain(row: MenuItemRow): MenuItem {
  return MenuItem.crear({
    id: row.id,
    nombre: row.nombre,
    categoriaId: row.categoriaId,
    precio: decimalToMoney(row.precio),
    fotoUrl: row.fotoUrl,
    stockDelDia: row.stockDelDia,
    disponible: row.disponible,
  });
}

/* -------------------------------------------------------------------------- */
/*  Órdenes                                                                    */
/* -------------------------------------------------------------------------- */

export function toOrderItemDomain(row: OrderItemRow): OrderItem {
  return OrderItem.crear({
    id: row.id,
    menuItemId: row.menuItemId,
    nombrePlato: row.nombrePlato,
    precioUnit: decimalToMoney(row.precioUnit),
    cantidad: row.cantidad,
  });
}

/** Fila de `Order` con sus ítems incluidos (resultado de `include: { items }`). */
export type OrderRowWithItems = OrderRow & { items: OrderItemRow[] };

export function toOrderDomain(row: OrderRowWithItems): Order {
  return Order.crear({
    id: row.id,
    numero: row.numero,
    canal: row.canal as OrderChannel,
    estado: row.estado as OrderStatus,
    mesa: row.mesa,
    clienteNombre: row.clienteNombre,
    clienteDireccion: row.clienteDireccion,
    clienteTelefono: row.clienteTelefono,
    envio: decimalToMoney(row.envio),
    envases: decimalToMoney(row.envases),
    subtotal: decimalToMoney(row.subtotal),
    total: decimalToMoney(row.total),
    metodoPago: (row.metodoPago as MetodoPago | null) ?? null,
    comprobanteUrl: row.comprobanteUrl,
    items: row.items.map(toOrderItemDomain),
    creadoPorId: row.creadoPorId,
  });
}

/* -------------------------------------------------------------------------- */
/*  Caja                                                                       */
/* -------------------------------------------------------------------------- */

export function toCajaSessionDomain(row: CajaSessionRow): CajaSession {
  return CajaSession.crear({
    id: row.id,
    fecha: row.fecha,
    fondoInicial: decimalToMoney(row.fondoInicial),
    estado: row.estado as CajaEstado,
    efectivoContado: decimalToMoneyOrNull(row.efectivoContado),
    diferencia: decimalToMoneyOrNull(row.diferencia),
    firmadoPorId: row.firmadoPorId,
    closedAt: row.closedAt,
  });
}

export function toMovimientoCajaDomain(row: MovimientoCajaRow): MovimientoCaja {
  return MovimientoCaja.crear({
    id: row.id,
    sesionId: row.sesionId,
    tipo: row.tipo as TipoMovimiento,
    libro: row.libro as Libro,
    monto: decimalToMoney(row.monto),
    orderId: row.orderId,
    categoria: row.categoria,
    esCarreraPassthrough: row.esCarreraPassthrough,
    empleadoId: row.empleadoId,
    nota: row.nota,
    timestamp: row.timestamp,
  });
}

/* -------------------------------------------------------------------------- */
/*  Usuario                                                                    */
/* -------------------------------------------------------------------------- */

export function toUserDomain(row: UserRow): User {
  return User.crear({
    id: row.id,
    usuario: row.usuario,
    claveHash: row.claveHash,
    nombre: row.nombre,
    roles: row.roles.map((r) => r as Role),
    puedeCobrar: row.puedeCobrar,
    activo: row.activo,
  });
}

/* -------------------------------------------------------------------------- */
/*  Auditoría                                                                  */
/* -------------------------------------------------------------------------- */

export function toAuditEntryDomain(row: AuditEntryRow): AuditEntry {
  return AuditEntry.crear({
    id: row.id,
    usuarioId: row.usuarioId,
    accion: row.accion,
    entidadTipo: row.entidadTipo,
    entidadId: row.entidadId,
    detalle: row.detalle as Record<string, unknown> | null,
    timestamp: row.timestamp,
  });
}
