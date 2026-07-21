import { getIniciarPreparacion } from "@/infrastructure/di/container";
import { ejecutarTransicion } from "@/presentation/http/orderTransition";

export const runtime = "nodejs";

/** `POST /api/orders/[id]/iniciar` (R6.2). */
export function POST(request: Request, { params }: { params: { id: string } }) {
  return ejecutarTransicion(request, params.id, getIniciarPreparacion());
}
