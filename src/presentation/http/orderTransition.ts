import { NextResponse } from "next/server";

import type { Order } from "@/domain/order/Order";
import type { Result } from "@/domain/shared/Result";

import { requireSession } from "./apiSession";
import { respondResult } from "./respond";
import { toOrderDTO } from "./serializers";

/** Caso de uso de transición de orden con la firma `ejecutar(orderId)`. */
interface TransicionUseCase {
  ejecutar(orderId: string): Promise<Result<Order>>;
}

/**
 * Ejecuta una transición de orden expuesta como endpoint (enviar a cocina,
 * iniciar preparación, marcar lista, entregar). Todas comparten el mismo
 * contrato HTTP: exigen sesión, ejecutan el caso de uso con el `orderId` y
 * mapean el `Result` (incluida la transición inválida → 422, R6.7).
 */
export async function ejecutarTransicion(
  request: Request,
  orderId: string,
  uc: TransicionUseCase,
): Promise<NextResponse> {
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  return respondResult(await uc.ejecutar(orderId), toOrderDTO);
}
