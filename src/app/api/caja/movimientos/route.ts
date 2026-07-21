import { NextResponse } from "next/server";

import { Money } from "@/domain/order/Money";
import type { User } from "@/domain/user/User";
import type { Result } from "@/domain/shared/Result";
import type { MovimientoCaja } from "@/domain/caja/MovimientoCaja";
import {
  getIngresoRetiroManual,
  getRegistrarCompraMenor,
  getRegistrarPagoProveedor,
} from "@/infrastructure/di/container";
import { badRequest, forbidden } from "@/presentation/http/apiError";
import { cargarUsuarioDominio, requireAdmin } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toMovimientoDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/** Tipos de movimiento manual que admite el endpoint (R11.3–R11.6). */
type TipoManual =
  | "PAGO_PROVEEDOR"
  | "COMPRA_MENOR"
  | "INGRESO_MANUAL"
  | "RETIRO_MANUAL";

/**
 * `POST /api/caja/movimientos` (R11.3–R11.6): asienta un movimiento manual de
 * caja. Solo admin. El campo `tipo` selecciona el caso de uso; el signo lo
 * aplica cada caso de uso, aquí se envía siempre la magnitud positiva.
 */
export async function POST(request: Request) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: {
    tipo?: unknown;
    monto?: unknown;
    categoria?: unknown;
    nota?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Cuerpo de la solicitud inválido");
  }

  if (!esTipoManual(body.tipo)) {
    return badRequest(
      "tipo debe ser PAGO_PROVEEDOR, COMPRA_MENOR, INGRESO_MANUAL o RETIRO_MANUAL",
    );
  }
  if (typeof body.monto !== "number") {
    return badRequest("monto es requerido");
  }

  const actor = await cargarUsuarioDominio(session);
  if (!actor) {
    return forbidden("El usuario de la sesión ya no existe");
  }

  const args = {
    actor,
    monto: Money.de(body.monto),
    categoria: typeof body.categoria === "string" ? body.categoria : null,
    nota: typeof body.nota === "string" ? body.nota : null,
  };

  const resultado = await ejecutarPorTipo(body.tipo, args);
  return respondResult(resultado, toMovimientoDTO, 201);
}

function ejecutarPorTipo(
  tipo: TipoManual,
  args: { actor: User; monto: Money; categoria: string | null; nota: string | null },
): Promise<Result<MovimientoCaja>> {
  switch (tipo) {
    case "PAGO_PROVEEDOR":
      return getRegistrarPagoProveedor().ejecutar(args);
    case "COMPRA_MENOR":
      return getRegistrarCompraMenor().ejecutar(args);
    case "INGRESO_MANUAL":
      return getIngresoRetiroManual().ingreso(args);
    case "RETIRO_MANUAL":
      return getIngresoRetiroManual().retiro(args);
  }
}

function esTipoManual(v: unknown): v is TipoManual {
  return (
    v === "PAGO_PROVEEDOR" ||
    v === "COMPRA_MENOR" ||
    v === "INGRESO_MANUAL" ||
    v === "RETIRO_MANUAL"
  );
}
