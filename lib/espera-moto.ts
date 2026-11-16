import type { Prisma } from '@prisma/client';

const PISO_TIEMPO_MIN = 15;
const MIN_POR_ORDEN_EN_COCINA = 3;
const LLEGADA_MOTO_MIN = 5;
// shortcut: vigencia cuenta desde createdAt, así que una orden sin stock aprobada tarde envejece desde su creación, no desde la aprobación; mejorar si las aprobaciones se retrasan a menudo.
const MARGEN_VIGENCIA_MIN = 10;
const TOPE_ESPERA_MIN = 45;
const COTA_CONSULTA_MS = 3 * 60 * 60_000;

const baseMin = (tiempoEstimado: number | null | undefined) => Math.max(tiempoEstimado ?? 0, PISO_TIEMPO_MIN);

/** Minutos que la moto debe esperar: cocina propia + carga actual − llegada de la moto, con tope. */
export function esperaMotoPorCarga(tiempoEstimado: number | null | undefined, enCocina: number): number {
  return Math.min(baseMin(tiempoEstimado) + MIN_POR_ORDEN_EN_COCINA * enCocina - LLEGADA_MOTO_MIN, TOPE_ESPERA_MIN);
}

/** Una orden sin cerrar se descarta como "olvidada" pasado su tiempo + margen. */
export function ordenSigueEnCocina(o: { createdAt: Date; tiempoEstimado: number | null }, ahora: Date): boolean {
  return o.createdAt.getTime() + (baseMin(o.tiempoEstimado) + MARGEN_VIGENCIA_MIN) * 60_000 > ahora.getTime();
}

export async function contarOrdenesEnCocina(tx: Prisma.TransactionClient, excluirId: string, ahora: Date): Promise<number> {
  const ordenes = await tx.orden.findMany({
    where: {
      anulada: false,
      estado: { in: ['pendiente', 'en_preparacion'] },
      id: { not: excluirId },
      createdAt: { gte: new Date(ahora.getTime() - COTA_CONSULTA_MS) },
    },
    select: { createdAt: true, tiempoEstimado: true },
  });
  return ordenes.filter(o => ordenSigueEnCocina(o, ahora)).length;
}

export type EsperaMoto = { minutos: number; enCocina: number | null };

export async function resolverEsperaMoto(
  tx: Prisma.TransactionClient,
  orden: { id: string; tipoOrden: string; tiempoEstimado: number | null },
  ahora: Date,
  esperaLinea: number | null | undefined,
): Promise<EsperaMoto | null> {
  if (orden.tipoOrden !== 'domicilio') return null;
  if (typeof esperaLinea === 'number') return { minutos: esperaLinea, enCocina: null };
  const n = await contarOrdenesEnCocina(tx, orden.id, ahora);
  return { minutos: esperaMotoPorCarga(orden.tiempoEstimado, n), enCocina: n };
}
