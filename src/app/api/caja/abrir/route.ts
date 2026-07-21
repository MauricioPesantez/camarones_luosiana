import { NextResponse } from "next/server";

import { Money } from "@/domain/order/Money";
import { getAbrirCaja } from "@/infrastructure/di/container";
import { badRequest, forbidden } from "@/presentation/http/apiError";
import { cargarUsuarioDominio, requireAdmin } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toCajaSessionDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `POST /api/caja/abrir` (R10): abre la jornada con un fondo inicial. Solo admin
 * (revalidado en el caso de uso con la entidad `User`, defensa en profundidad).
 */
export async function POST(request: Request) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: { fondoInicial?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Cuerpo de la solicitud inválido");
  }
  if (typeof body.fondoInicial !== "number") {
    return badRequest("fondoInicial es requerido");
  }

  const actor = await cargarUsuarioDominio(session);
  if (!actor) {
    return forbidden("El usuario de la sesión ya no existe");
  }

  const resultado = await getAbrirCaja().ejecutar({
    actor,
    fondoInicial: Money.de(body.fondoInicial),
  });

  return respondResult(resultado, toCajaSessionDTO, 201);
}
