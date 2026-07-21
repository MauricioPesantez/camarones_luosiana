"use client";

import type { PlatoDraft } from "./menu";

export interface PlatoFormProps {
  readonly draft: PlatoDraft;
  readonly onCampo: (campo: keyof PlatoDraft, valor: string) => void;
  readonly onGuardar: () => void;
  readonly onCancelar?: () => void;
  readonly editando: boolean;
  readonly puedeGuardar: boolean;
  readonly procesando?: boolean;
}

const INPUT =
  "min-h-[44px] rounded-md border border-input bg-background px-3 text-foreground";

/**
 * Formulario de creación/edición de plato (R3.1). Presentacional puro: captura
 * los campos como texto y emite `onGuardar`. La confirmación y los toasts los
 * orquesta el container.
 */
export function PlatoForm({
  draft,
  onCampo,
  onGuardar,
  onCancelar,
  editando,
  puedeGuardar,
  procesando = false,
}: PlatoFormProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-5">
      <h2 className="text-lg font-bold text-foreground">
        {editando ? "Editar plato" : "Nuevo plato"}
      </h2>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Nombre
        <input
          type="text"
          value={draft.nombre}
          onChange={(e) => onCampo("nombre", e.target.value)}
          className={INPUT}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Categoría
        <input
          type="text"
          value={draft.categoriaId}
          onChange={(e) => onCampo("categoriaId", e.target.value)}
          className={INPUT}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Precio
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={draft.precio}
            onChange={(e) => onCampo("precio", e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Stock del día
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            value={draft.stockDelDia}
            onChange={(e) => onCampo("stockDelDia", e.target.value)}
            className={INPUT}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Foto (URL, opcional)
        <input
          type="text"
          value={draft.fotoUrl}
          onChange={(e) => onCampo("fotoUrl", e.target.value)}
          className={INPUT}
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onGuardar}
          disabled={!puedeGuardar || procesando}
          className="min-h-[44px] flex-1 rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {procesando ? "Guardando…" : editando ? "Guardar cambios" : "Crear plato"}
        </button>
        {editando && onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="min-h-[44px] rounded-md border border-input px-4 font-medium text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
