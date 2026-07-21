import type {
  CajaSessionDTO,
  CierreResultadoDTO,
  EstadoCajaDTO,
  MovimientoDTO,
} from "@/presentation/http/dto";

import { apiFetch } from "./client";

/** Tipos de movimiento manual que admite el endpoint (R11.3–R11.6). */
export type TipoMovimientoManual =
  | "PAGO_PROVEEDOR"
  | "COMPRA_MENOR"
  | "INGRESO_MANUAL"
  | "RETIRO_MANUAL";

export interface MovimientoManualPayload {
  tipo: TipoMovimientoManual;
  monto: number;
  categoria?: string | null;
  nota?: string | null;
}

/** `GET /api/caja` — estado de caja (sesión, movimientos, cuadre en vivo). */
export function estadoCaja(signal?: AbortSignal): Promise<EstadoCajaDTO> {
  return apiFetch<EstadoCajaDTO>("/api/caja", { signal });
}

/** `POST /api/caja/abrir` — abre la jornada con un fondo inicial (R10). */
export function abrirCaja(fondoInicial: number): Promise<CajaSessionDTO> {
  return apiFetch<CajaSessionDTO>("/api/caja/abrir", {
    method: "POST",
    body: JSON.stringify({ fondoInicial }),
  });
}

/** `POST /api/caja/movimientos` — asienta un movimiento manual (R11.3–R11.6). */
export function registrarMovimiento(
  payload: MovimientoManualPayload,
): Promise<MovimientoDTO> {
  return apiFetch<MovimientoDTO>("/api/caja/movimientos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** `POST /api/caja/cerrar` — cuadra y firma la jornada (R13). */
export function cerrarCaja(efectivoContado: number): Promise<CierreResultadoDTO> {
  return apiFetch<CierreResultadoDTO>("/api/caja/cerrar", {
    method: "POST",
    body: JSON.stringify({ efectivoContado }),
  });
}
