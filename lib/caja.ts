import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { obtenerFechaEcuador } from "@/lib/fecha-ecuador";
import { ESTADO_CAJA_ABIERTA, type SesionCaja } from "@/types/caja";

export class CajaNoDisponibleError extends Error {}

export const CAJA_SELECT = {
  id: true,
  fecha: true,
  estado: true,
  montoInicial: true,
  abiertaPorId: true,
  abiertaPorNombre: true,
  abiertaPorRol: true,
  abiertaAt: true,
  montoEsperadoCierre: true,
  montoCierre: true,
  diferenciaCierre: true,
  cerradaPorId: true,
  cerradaPorNombre: true,
  cerradaAt: true,
} satisfies Prisma.SesionCajaSelect;

type CajaSeleccionada = Prisma.SesionCajaGetPayload<{
  select: typeof CAJA_SELECT;
}>;

export function serializarCaja(caja: CajaSeleccionada): SesionCaja {
  return {
    ...caja,
    estado: caja.estado as SesionCaja["estado"],
    montoInicial: Number(caja.montoInicial),
    montoEsperadoCierre:
      caja.montoEsperadoCierre === null
        ? null
        : Number(caja.montoEsperadoCierre),
    montoCierre: caja.montoCierre === null ? null : Number(caja.montoCierre),
    diferenciaCierre:
      caja.diferenciaCierre === null ? null : Number(caja.diferenciaCierre),
    abiertaAt: caja.abiertaAt.toISOString(),
    cerradaAt: caja.cerradaAt?.toISOString() ?? null,
  };
}

export async function obtenerCajaDeHoy() {
  return prisma.sesionCaja.findUnique({
    where: { fecha: obtenerFechaEcuador() },
    select: CAJA_SELECT,
  });
}

export async function exigirCajaAbierta(): Promise<void> {
  const caja = await obtenerCajaDeHoy();
  if (!caja) {
    throw new CajaNoDisponibleError(
      "La caja de hoy no ha sido iniciada. Un mesero debe registrar el fondo inicial.",
    );
  }
  if (caja.estado !== ESTADO_CAJA_ABIERTA) {
    throw new CajaNoDisponibleError("La caja de hoy ya fue cerrada");
  }
}

/**
 * Candado financiero de la jornada. Debe llamarse dentro de la misma
 * transaccion que registra el movimiento; el cierre usa la misma fila y espera
 * a que terminen cobros/retiros ya iniciados antes de calcular el esperado.
 */
export async function bloquearCajaAbierta(
  tx: Prisma.TransactionClient,
): Promise<void> {
  const fecha = obtenerFechaEcuador();
  const cajas = await tx.$queryRaw<Array<{ estado: string }>>`
    SELECT "estado"
    FROM "SesionCaja"
    WHERE "fecha" = ${fecha}
    FOR UPDATE
  `;
  const caja = cajas[0];
  if (!caja) {
    throw new CajaNoDisponibleError(
      "La caja de hoy no ha sido iniciada. Un mesero debe registrar el fondo inicial.",
    );
  }
  if (caja.estado !== ESTADO_CAJA_ABIERTA) {
    throw new CajaNoDisponibleError("La caja de hoy ya fue cerrada");
  }
}
