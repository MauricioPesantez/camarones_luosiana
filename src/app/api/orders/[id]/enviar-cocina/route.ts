import { getEnviarACocina } from "@/infrastructure/di/container";
import { ejecutarTransicion } from "@/presentation/http/orderTransition";

export const runtime = "nodejs";

/** `POST /api/orders/[id]/enviar-cocina` (R6.1). */
export function POST(request: Request, { params }: { params: { id: string } }) {
  return ejecutarTransicion(request, params.id, getEnviarACocina());
}
