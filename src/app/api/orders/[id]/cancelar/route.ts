import { NextResponse } from "next/server";

import { getCancelarOrden } from "@/infrastructure/di/container";
import { badRequest } from "@/presentation/http/apiError";
import { requireSession } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toOrderDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `POST /api/orders/[id]/cancelar` (R6.8, R7). La autorización admin para
 * cancelar órdenes enviadas/cobradas la hace cumplir el caso de uso
 * (`CANCELACION_REQUIERE_ADMIN` → 403); cancelar desde `ABIERTA` no la exige.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let motivo: string | undefined;
  try {
    const body = (await request.json()) as { motivo?: unknown };
    if (body && typeof body.motivo === "string") {
      motivo = body.motivo;
    }
  } catch {
    // Cuerpo opcional: cancelar sin motivo es válido.
  }

  const resultado = await getCancelarOrden().ejecutar({
    orderId: params.id,
    actor: session,
    motivo,
  });

  return respondResult(resultado, toOrderDTO);
}
