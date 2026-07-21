import { NextResponse } from "next/server";

import { getAgregarItemAOrden } from "@/infrastructure/di/container";
import { badRequest } from "@/presentation/http/apiError";
import { requireSession } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toOrderDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `POST /api/orders/[id]/items` (R5.1, R3.3): agrega un ítem. Transaccional
 * (stock + auto-86) en el caso de uso; disponibilidad y estado permitido los
 * valida `AgregarItemAOrden`.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: { menuItemId?: unknown; cantidad?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Cuerpo de la solicitud inválido");
  }

  if (
    typeof body.menuItemId !== "string" ||
    typeof body.cantidad !== "number"
  ) {
    return badRequest("menuItemId y cantidad son requeridos");
  }

  const resultado = await getAgregarItemAOrden().ejecutar({
    orderId: params.id,
    menuItemId: body.menuItemId,
    cantidad: body.cantidad,
  });

  return respondResult(resultado, toOrderDTO, 201);
}
