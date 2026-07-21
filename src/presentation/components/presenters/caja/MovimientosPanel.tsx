"use client";

import type { MovimientoDTO } from "@/presentation/http/dto";
import type { TipoMovimientoManual } from "@/presentation/api/caja";

import {
  ETIQUETA_MOVIMIENTO,
  TIPOS_MOVIMIENTO_MANUAL,
  formatMoney,
} from "./caja";

export interface MovimientosPanelProps {
  readonly movimientos: readonly MovimientoDTO[];
  readonly tipo: TipoMovimientoManual;
  readonly onTipo: (tipo: TipoMovimientoManual) => void;
  readonly monto: string;
  readonly onMonto: (valor: string) => void;
  readonly nota: string;
  readonly onNota: (valor: string) => void;
  readonly onRegistrar: () => void;
  readonly puedeRegistrar: boolean;
  readonly procesando?: boolean;
}

/**
 * Registro y lista de movimientos manuales de la jornada (R11.3–R11.6).
 * Presentacional puro: formulario (tipo, monto, nota) más el historial de
 * movimientos de la sesión. El signo lo aplica cada caso de uso en el servidor;
 * aquí solo se captura la magnitud positiva.
 */
export function MovimientosPanel({
  movimientos,
  tipo,
  onTipo,
  monto,
  onMonto,
  nota,
  onNota,
  onRegistrar,
  puedeRegistrar,
  procesando = false,
}: MovimientosPanelProps) {
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border p-5">
      <h2 className="text-lg font-bold text-foreground">Movimientos</h2>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          Tipo
          <select
            value={tipo}
            onChange={(e) => onTipo(e.target.value as TipoMovimientoManual)}
            className="min-h-[44px] rounded-md border border-input bg-background px-3 text-foreground"
          >
            {TIPOS_MOVIMIENTO_MANUAL.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_MOVIMIENTO[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          Monto
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={monto}
            onChange={(e) => onMonto(e.target.value)}
            placeholder="0.00"
            className="min-h-[44px] rounded-md border border-input bg-background px-3 text-foreground"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          Nota (opcional)
          <input
            type="text"
            value={nota}
            onChange={(e) => onNota(e.target.value)}
            placeholder="Detalle del movimiento"
            className="min-h-[44px] rounded-md border border-input bg-background px-3 text-foreground"
          />
        </label>

        <button
          type="button"
          onClick={onRegistrar}
          disabled={!puedeRegistrar || procesando}
          className="min-h-[44px] rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {procesando ? "Registrando…" : "Registrar movimiento"}
        </button>
      </div>

      <ul className="flex flex-col gap-1">
        {movimientos.length === 0 ? (
          <li className="py-4 text-center text-sm text-muted-foreground">
            Sin movimientos aún.
          </li>
        ) : (
          movimientos.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
            >
              <span className="text-foreground">{m.tipo}</span>
              <span
                className={
                  m.monto < 0
                    ? "font-medium text-destructive"
                    : "font-medium text-foreground"
                }
              >
                {formatMoney(m.monto)}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
