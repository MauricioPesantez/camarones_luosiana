import { NextResponse } from "next/server";

import { Money } from "@/domain/order/Money";
import type { EditarPlatoInput } from "@/application/use-cases/menu/GestionarMenu";
import { getGestionarMenu } from "@/infrastructure/di/container";
import { badRequest } from "@/presentation/http/apiError";
import { requireAdmin } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toMenuItemDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/** `PATCH /api/menu/[id]` (R3.1): edita un plato. Solo admin. */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Cuerpo de la solicitud inválido");
  }

  const cambios: EditarPlatoInput = {};
  if (typeof body.nombre === "string") cambios.nombre = body.nombre;
  if (typeof body.categoriaId === "string") cambios.categoriaId = body.categoriaId;
  if (typeof body.precio === "number") cambios.precio = Money.de(body.precio);
  if (body.fotoUrl === null || typeof body.fotoUrl === "string") {
    cambios.fotoUrl = body.fotoUrl as string | null;
  }
  if (typeof body.stockDelDia === "number") cambios.stockDelDia = body.stockDelDia;
  if (typeof body.disponible === "boolean") cambios.disponible = body.disponible;

  const resultado = await getGestionarMenu().editar(params.id, cambios);
  return respondResult(resultado, toMenuItemDTO);
}

/** `DELETE /api/menu/[id]` (R3.1): elimina un plato. Solo admin. */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const resultado = await getGestionarMenu().eliminar(params.id);
  return respondResult(resultado, () => ({ ok: true }));
}
