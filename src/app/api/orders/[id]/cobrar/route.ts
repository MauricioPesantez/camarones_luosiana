import { NextResponse } from "next/server";

import { MetodoPago } from "@/domain/order/MetodoPago";
import type { ComprobanteInput } from "@/application/use-cases/orders/CobrarOrden";
import { getCobrarOrden } from "@/infrastructure/di/container";
import { badRequest } from "@/presentation/http/apiError";
import { requireSession } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toOrderDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `POST /api/orders/[id]/cobrar` (R9). El permiso `puedeCobrar` lo hace cumplir
 * el caso de uso (R2.3, R2.4 → 403).
 *
 * `EFECTIVO`: cuerpo JSON `{ metodoPago }`. `TRANSFERENCIA`: `multipart/form-data`
 * con `metodoPago` y el archivo `comprobante` (obligatorio, R9.3). El
 * content-type decide cómo se parsea.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const contentType = request.headers.get("content-type") ?? "";
  let metodoPago: string;
  let comprobante: ComprobanteInput | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    metodoPago = String(form.get("metodoPago") ?? "");
    const archivo = form.get("comprobante");
    if (archivo instanceof File) {
      comprobante = {
        archivo: Buffer.from(await archivo.arrayBuffer()),
        mime: archivo.type,
      };
    }
  } else {
    try {
      const body = (await request.json()) as { metodoPago?: unknown };
      metodoPago = String(body.metodoPago ?? "");
    } catch {
      return badRequest("Cuerpo de la solicitud inválido");
    }
  }

  if (!esMetodoValido(metodoPago)) {
    return badRequest("Método de pago inválido");
  }

  const resultado = await getCobrarOrden().ejecutar({
    orderId: params.id,
    actor: session,
    metodoPago,
    comprobante,
  });

  return respondResult(resultado, toOrderDTO);
}

function esMetodoValido(v: string): v is MetodoPago {
  return (Object.values(MetodoPago) as string[]).includes(v);
}
