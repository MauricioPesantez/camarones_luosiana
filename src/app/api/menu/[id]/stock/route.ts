import { NextResponse } from "next/server";

import { getAjustarStock } from "@/infrastructure/di/container";
import { badRequest } from "@/presentation/http/apiError";
import { requireAdmin } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toMenuItemDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `POST /api/menu/[id]/stock` (R3.6): ajuste manual del stock y/o
 * disponibilidad del plato. Solo admin. Body: `{ stock?: number, disponible?: boolean }`.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: { stock?: unknown; disponible?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Cuerpo de la solicitud inválido");
  }

  const ajustarStock = getAjustarStock();

  if (typeof body.stock === "number") {
    const resultado = await ajustarStock.establecerStock(params.id, body.stock);
    if (typeof body.disponible === "boolean") {
      // Si además se fuerza la disponibilidad, se aplica tras fijar el stock.
      const conDisponibilidad = await ajustarStock.forzarDisponibilidad(
        params.id,
        body.disponible,
      );
      return respondResult(conDisponibilidad, toMenuItemDTO);
    }
    return respondResult(resultado, toMenuItemDTO);
  }

  if (typeof body.disponible === "boolean") {
    const resultado = await ajustarStock.forzarDisponibilidad(
      params.id,
      body.disponible,
    );
    return respondResult(resultado, toMenuItemDTO);
  }

  return badRequest("Indica stock (number) y/o disponible (boolean)");
}
