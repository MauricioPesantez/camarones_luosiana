export type EstadoCaja = "abierta" | "cerrada";

export const ESTADO_CAJA_ABIERTA: EstadoCaja = "abierta";
export const ESTADO_CAJA_CERRADA: EstadoCaja = "cerrada";

/** Techo de sanidad para evitar errores de digitacion. */
export const MONTO_MAXIMO_CAJA = 9999.99;

/** Solo el mesero inicia la jornada; el administrador realiza el cierre. */
export const ROL_ABRE_CAJA = "mesero";
export const ROL_CIERRA_CAJA = "admin";

export interface SesionCaja {
  id: string;
  fecha: string;
  estado: EstadoCaja;
  montoInicial: number;
  abiertaPorId: string;
  abiertaPorNombre: string;
  abiertaPorRol: string;
  abiertaAt: string;
  montoEsperadoCierre: number | null;
  montoCierre: number | null;
  diferenciaCierre: number | null;
  cerradaPorId: string | null;
  cerradaPorNombre: string | null;
  cerradaAt: string | null;
}

export interface AbrirCajaRequest {
  montoInicial: number;
}

export interface CerrarCajaRequest {
  fecha: string;
  montoCierre: number;
}
