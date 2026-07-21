import { NextResponse } from "next/server";

import { Money } from "@/domain/order/Money";
import { getGestionarMenu, getMenuRepository } from "@/infrastructure/di/container";
import { badRequest } from "@/presentation/http/apiError";
import { requireAdmin, requireSession } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toMenuItemDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/** `GET /api/menu`: lista los platos (cualquier usuario autenticado, R3). */
export async function GET(request: Request) {
  const session = await requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const items = await getMenuRepository().listar();
  return NextResponse.json({ items: items.map(toMenuItemDTO) });
}

interface CrearPlatoBody {
  nombre?: unknown;
  categoriaId?: unknown;
  precio?: unknown;
  fotoUrl?: unknown;
  stockDelDia?: unknown;
  disponible?: unknown;
}

/** `POST /api/menu` (R3.1): crea un plato. Solo admin. */
export async function POST(request: Request) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: CrearPlatoBody;
  try {
    body = (await request.json()) as CrearPlatoBody;
  } catch {
    return badRequest("Cuerpo de la solicitud inválido");
  }

  if (
    typeof body.nombre !== "string" ||
    typeof body.categoriaId !== "string" ||
    typeof body.precio !== "number" ||
    typeof body.stockDelDia !== "number"
  ) {
    return badRequest("nombre, categoriaId, precio y stockDelDia son requeridos");
  }

  const resultado = await getGestionarMenu().crear({
    nombre: body.nombre,
    categoriaId: body.categoriaId,
    precio: Money.de(body.precio),
    fotoUrl: typeof body.fotoUrl === "string" ? body.fotoUrl : null,
    stockDelDia: body.stockDelDia,
    disponible: typeof body.disponible === "boolean" ? body.disponible : true,
  });

  return respondResult(resultado, toMenuItemDTO, 201);
}
