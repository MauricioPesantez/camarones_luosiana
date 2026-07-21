import { getMarcarOrdenLista } from "@/infrastructure/di/container";
import { ejecutarTransicion } from "@/presentation/http/orderTransition";

export const runtime = "nodejs";

/** `POST /api/orders/[id]/lista` (R6.3, R15.1). */
export function POST(request: Request, { params }: { params: { id: string } }) {
  return ejecutarTransicion(request, params.id, getMarcarOrdenLista());
}
