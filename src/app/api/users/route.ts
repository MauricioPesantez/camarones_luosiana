import { NextResponse } from "next/server";

import { Role } from "@/domain/user/Role";
import { getGestionarUsuarios } from "@/infrastructure/di/container";
import { badRequest } from "@/presentation/http/apiError";
import { requireAdmin } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toUserDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/** `GET /api/users` (R2.6): lista los usuarios. Solo admin. */
export async function GET(request: Request) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }
  const usuarios = await getGestionarUsuarios().listar();
  return NextResponse.json({ users: usuarios.map(toUserDTO) });
}

interface CrearUsuarioBody {
  usuario?: unknown;
  nombre?: unknown;
  clave?: unknown;
  roles?: unknown;
  puedeCobrar?: unknown;
}

/** `POST /api/users` (R2.1, R2.6): crea un usuario. Solo admin. */
export async function POST(request: Request) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: CrearUsuarioBody;
  try {
    body = (await request.json()) as CrearUsuarioBody;
  } catch {
    return badRequest("Cuerpo de la solicitud inválido");
  }

  if (
    typeof body.usuario !== "string" ||
    typeof body.nombre !== "string" ||
    typeof body.clave !== "string" ||
    !esArrayDeRoles(body.roles)
  ) {
    return badRequest("usuario, nombre, clave y roles son requeridos");
  }

  const resultado = await getGestionarUsuarios().crear({
    usuario: body.usuario,
    nombre: body.nombre,
    clave: body.clave,
    roles: body.roles,
    puedeCobrar:
      typeof body.puedeCobrar === "boolean" ? body.puedeCobrar : undefined,
  });

  return respondResult(resultado, toUserDTO, 201);
}

function esArrayDeRoles(v: unknown): v is Role[] {
  return (
    Array.isArray(v) &&
    v.every((r) => (Object.values(Role) as string[]).includes(r))
  );
}
