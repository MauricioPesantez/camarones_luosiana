"use client";

import type { AuditFiltro } from "@/presentation/api/audit";

export interface AuditFiltroBarProps {
  readonly filtro: AuditFiltro;
  readonly onCampo: (campo: keyof AuditFiltro, valor: string) => void;
  readonly onBuscar: () => void;
  readonly onLimpiar: () => void;
  readonly cargando?: boolean;
}

const INPUT =
  "min-h-[44px] rounded-md border border-input bg-background px-3 text-sm text-foreground";

/**
 * Barra de filtros de la consulta de auditoría (R16.3). Presentacional puro:
 * captura usuario, acción, entidad y rango de fechas y emite `onBuscar`.
 */
export function AuditFiltroBar({
  filtro,
  onCampo,
  onBuscar,
  onLimpiar,
  cargando = false,
}: AuditFiltroBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Usuario (id)
        <input
          type="text"
          value={filtro.usuario ?? ""}
          onChange={(e) => onCampo("usuario", e.target.value)}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Acción
        <input
          type="text"
          value={filtro.accion ?? ""}
          onChange={(e) => onCampo("accion", e.target.value)}
          placeholder="CERRAR_CAJA"
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Entidad
        <input
          type="text"
          value={filtro.entidad ?? ""}
          onChange={(e) => onCampo("entidad", e.target.value)}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Desde
        <input
          type="date"
          value={filtro.desde ?? ""}
          onChange={(e) => onCampo("desde", e.target.value)}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Hasta
        <input
          type="date"
          value={filtro.hasta ?? ""}
          onChange={(e) => onCampo("hasta", e.target.value)}
          className={INPUT}
        />
      </label>

      <button
        type="button"
        onClick={onBuscar}
        disabled={cargando}
        className="min-h-[44px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {cargando ? "Buscando…" : "Buscar"}
      </button>
      <button
        type="button"
        onClick={onLimpiar}
        className="min-h-[44px] rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-muted"
      >
        Limpiar
      </button>
    </div>
  );
}
