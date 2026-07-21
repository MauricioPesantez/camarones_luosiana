import { NextResponse } from "next/server";

import { Money } from "@/domain/order/Money";
import { getCerrarCaja } from "@/infrastructure/di/container";
import { badRequest, forbidden } from "@/presentation/http/apiError";
import { cargarUsuarioDominio, requireAdmin } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toCierreResultadoDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `POST /api/caja/cerrar` (R13): cuadra y firma la jornada. Solo admin. Devuelve
 * la sesión cerrada más el cuadre legible (esperado, diferencia, puente).
 */
export async function POST(request: Request) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: { efectivoContado?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Cuerpo de la solicitud inválido");
  }
  if (typeof body.efectivoContado !== "number") {
    return badRequest("efectivoContado es requerido");
  }

  const actor = await cargarUsuarioDominio(session);
  if (!actor) {
    return forbidden("El usuario de la sesión ya no existe");
  }

  const resultado = await getCerrarCaja().ejecutar({
    actor,
    efectivoContado: Money.de(body.efectivoContado),
  });

  return respondResult(resultado, toCierreResultadoDTO);
}
