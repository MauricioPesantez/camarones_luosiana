"use client";

import {
  diferenciaEnVivo,
  etiquetaDiferencia,
  formatMoney,
} from "./caja";

export interface CierrePanelProps {
  readonly esperado: number;
  readonly puente: number;
  readonly contado: string;
  readonly onContado: (valor: string) => void;
  readonly onCerrar: () => void;
  readonly puedeCerrar: boolean;
  readonly procesando?: boolean;
}

/**
 * Panel de cierre legible de la jornada (R13.4, R13.7). Presentacional puro:
 * muestra el efectivo esperado y el puente, captura el efectivo contado y
 * calcula la diferencia en vivo (sobrante/faltante/cuadre) para que el cierre
 * sea deliberado. La confirmación (modal) y el toast los orquesta el container.
 */
export function CierrePanel({
  esperado,
  puente,
  contado,
  onContado,
  onCerrar,
  puedeCerrar,
  procesando = false,
}: CierrePanelProps) {
  const contadoNum = contado === "" ? null : Number(contado);
  const diferencia =
    contadoNum !== null && Number.isFinite(contadoNum)
      ? diferenciaEnVivo(contadoNum, esperado)
      : null;

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border p-5">
      <h2 className="text-lg font-bold text-foreground">Cierre de caja</h2>

      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Efectivo esperado</dt>
          <dd className="font-medium text-foreground">
            {formatMoney(esperado)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Puente (carreras)</dt>
          <dd className="font-medium text-foreground">{formatMoney(puente)}</dd>
        </div>
      </dl>

      <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
        Efectivo contado
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={contado}
          onChange={(e) => onContado(e.target.value)}
          placeholder="0.00"
          className="min-h-[44px] rounded-md border border-input bg-background px-3 text-foreground"
        />
      </label>

      {diferencia !== null && (
        <div
          aria-live="polite"
          className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm"
        >
          <span className="text-muted-foreground">
            {etiquetaDiferencia(diferencia)}
          </span>
          <span className="font-bold text-foreground">
            {formatMoney(Math.abs(diferencia))}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onCerrar}
        disabled={!puedeCerrar || procesando}
        className="min-h-[44px] rounded-md bg-destructive px-4 font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
      >
        {procesando ? "Cerrando…" : "Cerrar caja"}
      </button>
    </div>
  );
}
