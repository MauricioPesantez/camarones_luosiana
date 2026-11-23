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
  /** Desde aqui quien entrego el conteo ve las ordenes y nadie vuelve a contar. */
  ordenesHabilitadasAt: string | null;
  ordenesHabilitadasPorNombre: string | null;
  /** Relevos de turno del dia, en orden. */
  cortes: CorteTurno[];
}

export interface CorteTurno {
  id: string;
  numero: number;
  usuarioId: string;
  /** Lo que recibio el turno: lo contado en el corte anterior o el fondo inicial. */
  fondoInicial: number;
  montoEsperado: number;
  montoContado: number;
  diferencia: number;
  usuarioNombre: string;
  anuladoPorNombre: string | null;
  razonAnulacion: string | null;
  anuladoAt: string | null;
  createdAt: string;
}

/**
 * Lo que ve quien no es admin: el conteo es a ciegas, asi que el servidor no
 * envia ni el esperado ni la diferencia (la razon de anulacion puede citarlos).
 */
export type CorteTurnoMesero = Omit<
  CorteTurno,
  "montoEsperado" | "diferencia" | "razonAnulacion"
>;
export type CajaMesero = Omit<
  SesionCaja,
  | "montoEsperadoCierre"
  | "montoCierre"
  | "diferenciaCierre"
  | "ordenesHabilitadasPorNombre"
  | "cortes"
> & { cortes: CorteTurnoMesero[] };

/** Lista explicita y no un descarte: un campo nuevo no llega al mesero por descuido. */
export function ocultarCuadre(caja: SesionCaja): CajaMesero {
  return {
    id: caja.id,
    fecha: caja.fecha,
    estado: caja.estado,
    montoInicial: caja.montoInicial,
    abiertaPorId: caja.abiertaPorId,
    abiertaPorNombre: caja.abiertaPorNombre,
    abiertaPorRol: caja.abiertaPorRol,
    abiertaAt: caja.abiertaAt,
    cerradaPorId: caja.cerradaPorId,
    cerradaPorNombre: caja.cerradaPorNombre,
    cerradaAt: caja.cerradaAt,
    ordenesHabilitadasAt: caja.ordenesHabilitadasAt,
    cortes: caja.cortes.map((corte) => ({
      id: corte.id,
      numero: corte.numero,
      usuarioId: corte.usuarioId,
      usuarioNombre: corte.usuarioNombre,
      fondoInicial: corte.fondoInicial,
      montoContado: corte.montoContado,
      anuladoPorNombre: corte.anuladoPorNombre,
      anuladoAt: corte.anuladoAt,
      createdAt: corte.createdAt,
    })),
  };
}

/** Los turnos del dia: un corte anulado no es un turno, aunque conserve su numero. */
export function cortesVigentes<T extends { anuladoAt: unknown }>(
  cortes: readonly T[],
): T[] {
  return cortes.filter((corte) => corte.anuladoAt === null);
}

/** Cortes en orden: el siguiente turno parte del ultimo que no fue anulado. */
export function ultimoCorteVigente<T extends { anuladoAt: unknown }>(
  cortes: readonly T[],
): T | undefined {
  return cortesVigentes(cortes).at(-1);
}

export interface SalidaDeTurno {
  id: string;
  categoria: string;
  monto: number;
  usuarioNombre: string;
  createdAt: string;
}

export interface AbrirCajaRequest {
  montoInicial: number;
}

export interface CerrarCajaRequest {
  fecha: string;
  montoCierre: number;
}
