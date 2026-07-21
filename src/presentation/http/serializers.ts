import type { SessionUser } from "@/application/ports/AuthService";
import type { CerrarCajaResultado } from "@/application/use-cases/caja/CerrarCaja";
import type { AuditEntry } from "@/domain/audit/AuditEntry";
import type { CajaSession } from "@/domain/caja/CajaSession";
import type { MovimientoCaja } from "@/domain/caja/MovimientoCaja";
import type { Money } from "@/domain/order/Money";
import type { MenuItem } from "@/domain/menu/MenuItem";
import type { Order } from "@/domain/order/Order";
import type { OrderItem } from "@/domain/order/OrderItem";
import type { User } from "@/domain/user/User";

/**
 * Serializadores de entidad → DTO plano (JSON).
 *
 * Las entidades de dominio tienen campos privados y value objects (`Money`,
 * fechas). La API nunca serializa la entidad directa: estos DTO exponen solo
 * datos públicos, con los montos convertidos a número decimal vía
 * `Money.toDecimal()` y las fechas a ISO. Aísla el contrato HTTP de la forma
 * interna del dominio.
 */

export function toOrderItemDTO(item: OrderItem) {
  return {
    id: item.id,
    menuItemId: item.menuItemId,
    nombrePlato: item.nombrePlato,
    precioUnit: item.precioUnit.toDecimal(),
    cantidad: item.cantidad,
  };
}

export function toOrderDTO(order: Order) {
  return {
    id: order.id,
    numero: order.numero,
    canal: order.canal,
    estado: order.estado,
    mesa: order.mesa,
    clienteNombre: order.clienteNombre,
    clienteDireccion: order.clienteDireccion,
    clienteTelefono: order.clienteTelefono,
    subtotal: order.subtotal.toDecimal(),
    envases: order.envases.toDecimal(),
    envio: order.envio.toDecimal(),
    total: order.total.toDecimal(),
    items: order.items.map(toOrderItemDTO),
  };
}

export function toMenuItemDTO(item: MenuItem) {
  return {
    id: item.id,
    nombre: item.nombre,
    categoriaId: item.categoriaId,
    precio: item.precio.toDecimal(),
    fotoUrl: item.fotoUrl,
    stockDelDia: item.stockDelDia,
    disponible: item.disponible,
  };
}

export function toMovimientoDTO(m: MovimientoCaja) {
  return {
    id: m.id,
    sesionId: m.sesionId,
    tipo: m.tipo,
    libro: m.libro,
    monto: m.monto.toDecimal(),
    orderId: m.orderId,
    categoria: m.categoria,
    esCarreraPassthrough: m.esCarreraPassthrough,
    empleadoId: m.empleadoId,
    nota: m.nota,
    timestamp: m.timestamp.toISOString(),
  };
}

export function toCajaSessionDTO(s: CajaSession) {
  return {
    id: s.id,
    fecha: s.fecha.toISOString(),
    fondoInicial: s.fondoInicial.toDecimal(),
    estado: s.estado,
    efectivoContado: s.efectivoContado?.toDecimal() ?? null,
    diferencia: s.diferencia?.toDecimal() ?? null,
    firmadoPorId: s.firmadoPorId,
    closedAt: s.closedAt?.toISOString() ?? null,
  };
}

/**
 * DTO del estado de caja para la pantalla de caja/cierre (R10, R11, R13). Reúne
 * la sesión abierta (o `null`), sus movimientos y el cuadre en vivo (efectivo
 * esperado y puente) para que la pantalla muestre el cierre legible antes de
 * firmarlo. El cálculo se hace con las funciones puras de `cierre.ts` en el
 * route handler; aquí solo se serializa.
 */
export function toEstadoCajaDTO(input: {
  sesion: CajaSession | null;
  movimientos: readonly MovimientoCaja[];
  esperado: Money;
  puente: Money;
}) {
  return {
    sesion: input.sesion ? toCajaSessionDTO(input.sesion) : null,
    movimientos: input.movimientos.map(toMovimientoDTO),
    esperado: input.esperado.toDecimal(),
    puente: input.puente.toDecimal(),
  };
}

/**
 * DTO del resultado del cierre (R13.1–R13.3, R6.6): la sesión firmada más el
 * cuadre legible (esperado, diferencia, puente) y cuántas órdenes cobradas se
 * cerraron. Única fuente de verdad del contrato del endpoint de cierre.
 */
export function toCierreResultadoDTO(r: CerrarCajaResultado) {
  return {
    sesion: toCajaSessionDTO(r.sesion),
    esperado: r.esperado.toDecimal(),
    diferencia: r.diferencia.toDecimal(),
    puente: r.puente.toDecimal(),
    ordenesCerradas: r.ordenesCerradas,
  };
}

/** DTO público de usuario: nunca expone `claveHash`. */
export function toUserDTO(u: User) {
  return {
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    roles: [...u.roles],
    puedeCobrar: u.puedeCobrar,
    activo: u.activo,
  };
}

/** DTO del usuario de la sesión (JWT); expone lo mínimo para el cliente. */
export function toSessionUserDTO(u: SessionUser) {
  return {
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    roles: [...u.roles],
    puedeCobrar: u.puedeCobrar,
  };
}

export function toAuditEntryDTO(e: AuditEntry) {
  return {
    id: e.id,
    usuarioId: e.usuarioId,
    accion: e.accion,
    entidadTipo: e.entidadTipo,
    entidadId: e.entidadId,
    detalle: e.detalle,
    timestamp: e.timestamp.toISOString(),
  };
}
