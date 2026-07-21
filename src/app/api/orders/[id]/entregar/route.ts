import { getEntregarOrden } from "@/infrastructure/di/container";
import { ejecutarTransicion } from "@/presentation/http/orderTransition";

export const runtime = "nodejs";

/** `POST /api/orders/[id]/entregar` (R6.4). */
export function POST(request: Request, { params }: { params: { id: string } }) {
  return ejecutarTransicion(request, params.id, getEntregarOrden());
}
