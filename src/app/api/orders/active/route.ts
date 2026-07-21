import { NextResponse } from "next/server";

import { getOrderRepository } from "@/infrastructure/di/container";
import { requireSession } from "@/presentation/http/apiSession";
import { toOrderDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `GET /api/orders/active` (R14.1).
 *
 * Fuente de datos del KDS: devuelve las órdenes activas (no `CERRADA` ni
 * `CANCELADA`). El hook `usePollingOrders` la consulta cada 3–5s. Requiere
 * sesión válida; la cola es de solo lectura.
 */
export async function GET(request: Request) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const ordenes = await getOrderRepository().activas();
  return NextResponse.json({ orders: ordenes.map(toOrderDTO) });
}
