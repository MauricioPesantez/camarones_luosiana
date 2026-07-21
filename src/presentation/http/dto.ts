import type {
  toAuditEntryDTO,
  toCajaSessionDTO,
  toCierreResultadoDTO,
  toEstadoCajaDTO,
  toMenuItemDTO,
  toMovimientoDTO,
  toOrderDTO,
  toOrderItemDTO,
  toSessionUserDTO,
  toUserDTO,
} from "./serializers";

/**
 * Tipos del contrato HTTP, derivados de los serializadores.
 *
 * Los serializadores son la única fuente de verdad de la forma JSON. Derivar
 * los tipos con `ReturnType` evita duplicar la definición y garantiza que el
 * cliente (presenters/containers) y el servidor (route handlers) hablen
 * exactamente el mismo contrato: si cambia un serializador, el tipo cambia solo.
 */
export type OrderItemDTO = ReturnType<typeof toOrderItemDTO>;
export type OrderDTO = ReturnType<typeof toOrderDTO>;
export type MenuItemDTO = ReturnType<typeof toMenuItemDTO>;
export type MovimientoDTO = ReturnType<typeof toMovimientoDTO>;
export type CajaSessionDTO = ReturnType<typeof toCajaSessionDTO>;
export type EstadoCajaDTO = ReturnType<typeof toEstadoCajaDTO>;
export type CierreResultadoDTO = ReturnType<typeof toCierreResultadoDTO>;
export type UserDTO = ReturnType<typeof toUserDTO>;
export type SessionUserDTO = ReturnType<typeof toSessionUserDTO>;
export type AuditEntryDTO = ReturnType<typeof toAuditEntryDTO>;
