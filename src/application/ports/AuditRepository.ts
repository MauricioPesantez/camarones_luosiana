import { AuditEntry } from "@/domain/audit/AuditEntry";

/**
 * Filtro para consultar entradas de auditoría.
 */
export interface AuditFiltro {
  /** Filtrar por id del usuario que realizó la acción. */
  usuarioId?: string;
  /** Filtrar por tipo de acción (e.g., "CANCELAR_ORDEN"). */
  accion?: string;
  /** Filtrar por tipo de entidad (e.g., "Order", "CajaSession"). */
  entidadTipo?: string;
  /** Filtrar entradas desde esta fecha. */
  desde?: Date;
  /** Filtrar entradas hasta esta fecha. */
  hasta?: Date;
}

/**
 * Puerto para la persistencia de auditoría (R16).
 *
 * Abstrae el registro y consulta de `AuditEntry`.
 */
export interface AuditRepository {
  /** Registra una entrada de auditoría. */
  registrar(entry: AuditEntry): Promise<void>;

  /** Lista entradas de auditoría, opcionalmente filtradas. */
  listar(filtro?: AuditFiltro): Promise<AuditEntry[]>;
}
