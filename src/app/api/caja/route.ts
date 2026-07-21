import { NextResponse } from "next/server";

import { efectivoEsperado, puente } from "@/domain/caja/cierre";
import { getCajaRepository } from "@/infrastructure/di/container";
import { requireAdmin } from "@/presentation/http/apiSession";
import { toEstadoCajaDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `GET /api/caja` (R10, R11, R13): estado de caja para la pantalla de
 * caja/cierre. Devuelve la sesión abierta (o `null` si la jornada no está
 * abierta), sus movimientos y el cuadre en vivo (efectivo esperado y puente),
 * de modo que la pantalla muestre el cierre legible antes de firmarlo. Solo
 * admin (R2.5); consulta de solo lectura.
 */
export async function GET(request: Request) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const caja = getCajaRepository();
  const sesion = await caja.sesionAbierta();
  const movimientos = sesion
    ? await caja.movimientosDeSesion(sesion.id)
    : [];

  return NextResponse.json(
    toEstadoCajaDTO({
      sesion,
      movimientos,
      esperado: efectivoEsperado(movimientos),
      puente: puente(movimientos),
    }),
  );
}
