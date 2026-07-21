"use client";

export interface AperturaCajaProps {
  readonly fondo: string;
  readonly onFondo: (valor: string) => void;
  readonly onAbrir: () => void;
  readonly puedeAbrir: boolean;
  readonly procesando?: boolean;
}

/**
 * Apertura de la jornada (R10). Presentacional puro: captura el fondo inicial y
 * emite `onAbrir`. La confirmación y el toast los orquesta el container. Se
 * muestra cuando no hay una sesión de caja abierta.
 */
export function AperturaCaja({
  fondo,
  onFondo,
  onAbrir,
  puedeAbrir,
  procesando = false,
}: AperturaCajaProps) {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 rounded-lg border border-border p-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Abrir caja</h2>
        <p className="text-sm text-muted-foreground">
          No hay una jornada abierta. Ingresa el fondo inicial para comenzar.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        Fondo inicial
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={fondo}
          onChange={(e) => onFondo(e.target.value)}
          placeholder="0.00"
          className="min-h-[44px] rounded-md border border-input bg-background px-3 text-foreground"
        />
      </label>

      <button
        type="button"
        onClick={onAbrir}
        disabled={!puedeAbrir || procesando}
        className="min-h-[44px] rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {procesando ? "Abriendo…" : "Abrir caja"}
      </button>
    </div>
  );
}
