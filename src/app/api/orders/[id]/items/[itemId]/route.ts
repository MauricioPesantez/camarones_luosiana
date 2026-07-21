import { NextResponse } from "next/server";

import { getQuitarItem } from "@/infrastructure/di/container";
import { requireSession } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toOrderDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `DELETE /api/orders/[id]/items/[itemId]` (R5.1, R5.2): quita un ítem y
 * restaura el stock (transaccional en el caso de uso).
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; itemId: string } },
) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const resultado = await getQuitarItem().ejecutar({
    orderId: params.id,
    orderItemId: params.itemId,
  });

  return respondResult(resultado, toOrderDTO);
}
