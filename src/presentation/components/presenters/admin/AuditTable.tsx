"use client";

import type { AuditEntryDTO } from "@/presentation/http/dto";

import { etiquetaAccion, formatFechaHora, resumenDetalle } from "./auditoria";

export interface AuditTableProps {
  readonly entries: readonly AuditEntryDTO[];
}

/**
 * Tabla del registro de auditoría (R16.2, R16.3). Presentacional puro: lista
 * las acciones sensibles con fecha, actor, entidad y un resumen del detalle.
 * Solo lectura.
 */
export function AuditTable({ entries }: AuditTableProps) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin registros para el filtro actual.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex flex-col gap-1 rounded-md border border-border p-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-foreground">
              {etiquetaAccion(e.accion)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatFechaHora(e.timestamp)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {e.entidadTipo} · {e.entidadId} · usuario {e.usuarioId}
          </p>
          {resumenDetalle(e.detalle) && (
            <p className="text-xs text-foreground">{resumenDetalle(e.detalle)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
