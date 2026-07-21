import { DomainError } from "../shared/DomainError";

/**
 * Propiedades para crear/reconstituir un `AuditEntry`.
 */
export interface AuditEntryProps {
  id: string;
  usuarioId: string;
  accion: string;
  entidadTipo: string;
  entidadId: string;
  detalle?: Record<string, unknown> | null;
  timestamp: Date;
}

/**
 * Entidad `AuditEntry`: registro inmutable de una acción sensible (R16).
 *
 * Cada acción que requiere auditoría (cancelaciones, cierres, overrides)
 * genera un `AuditEntry` con la referencia al usuario, la entidad afectada
 * y un detalle libre en JSON.
 */
export class AuditEntry {
  private constructor(
    readonly id: string,
    readonly usuarioId: string,
    readonly accion: string,
    readonly entidadTipo: string,
    readonly entidadId: string,
    readonly detalle: Record<string, unknown> | null,
    readonly timestamp: Date,
  ) {}

  static crear(props: AuditEntryProps): AuditEntry {
    const id = props.id?.trim();
    if (!id) {
      throw new DomainError("AuditEntry requiere un id", "AUDIT_ID_VACIO");
    }
    const usuarioId = props.usuarioId?.trim();
    if (!usuarioId) {
      throw new DomainError(
        "AuditEntry requiere el id del usuario",
        "AUDIT_USUARIO_VACIO",
      );
    }
    const accion = props.accion?.trim();
    if (!accion) {
      throw new DomainError(
        "AuditEntry requiere una acción",
        "AUDIT_ACCION_VACIA",
      );
    }
    return new AuditEntry(
      id,
      usuarioId,
      accion,
      props.entidadTipo,
      props.entidadId,
      props.detalle ?? null,
      props.timestamp,
    );
  }
}
