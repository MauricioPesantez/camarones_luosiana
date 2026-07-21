"use client";

import { METODOS_PAGO, MetodoPago } from "@/domain/order/MetodoPago";
import type { OrderDTO } from "@/presentation/http/dto";

import { ETIQUETA_METODO, formatMoney } from "./cobro";

export interface CobroPanelProps {
  readonly order: OrderDTO;
  readonly metodo: MetodoPago;
  readonly onMetodo: (metodo: MetodoPago) => void;
  readonly comprobanteNombre: string | null;
  readonly onComprobante: (file: File) => void;
  readonly onRegistrar: () => void;
  readonly puedeRegistrar: boolean;
  readonly procesando?: boolean;
}

/**
 * Panel de cobro de la orden seleccionada (R9). Presentacional puro: selector
 * de método, subida de comprobante en transferencia (R9.3) y botón de registrar.
 * La confirmación (modal) y los toasts los orquesta el container.
 */
export function CobroPanel({
  order,
  metodo,
  onMetodo,
  comprobanteNombre,
  onComprobante,
  onRegistrar,
  puedeRegistrar,
  procesando = false,
}: CobroPanelProps) {
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-foreground">
          Orden #{order.numero}
        </h2>
        <span className="text-2xl font-bold text-foreground">
          {formatMoney(order.total)}
        </span>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">
          Método de pago
        </legend>
        <div className="flex gap-2">
          {METODOS_PAGO.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metodo === m}
              onClick={() => onMetodo(m)}
              className={
                metodo === m
                  ? "min-h-[44px] flex-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                  : "min-h-[44px] flex-1 rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted"
              }
            >
              {ETIQUETA_METODO[m]}
            </button>
          ))}
        </div>
      </fieldset>

      {metodo === MetodoPago.TRANSFERENCIA && (
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          Comprobante de transferencia
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onComprobante(file);
            }}
            className="text-sm text-muted-foreground file:mr-3 file:min-h-[44px] file:rounded-md file:border file:border-input file:bg-background file:px-4 file:text-foreground"
          />
          {comprobanteNombre && (
            <span className="text-xs text-muted-foreground">
              {comprobanteNombre}
            </span>
          )}
        </label>
      )}

      <button
        type="button"
        onClick={onRegistrar}
        disabled={!puedeRegistrar || procesando}
        className="min-h-[44px] rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {procesando ? "Registrando…" : "Registrar cobro"}
      </button>
    </div>
  );
}
