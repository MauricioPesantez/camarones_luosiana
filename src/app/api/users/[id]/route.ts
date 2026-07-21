import { NextResponse } from "next/server";

import { Role } from "@/domain/user/Role";
import type { Result } from "@/domain/shared/Result";
import type { User } from "@/domain/user/User";
import { getGestionarUsuarios } from "@/infrastructure/di/container";
import { badRequest } from "@/presentation/http/apiError";
import { requireAdmin } from "@/presentation/http/apiSession";
import { respondResult } from "@/presentation/http/respond";
import { toUserDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `PATCH /api/users/[id]` (R2.6): administra un usuario. Solo admin. El campo
 * `accion` selecciona la operación: asignar/revocar rol, forzar `puedeCobrar`,
 * cambiar nombre, activar/desactivar.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let body: {
    accion?: unknown;
    rol?: unknown;
    puedeCobrar?: unknown;
    nombre?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Cuerpo de la solicitud inválido");
  }

  const uc = getGestionarUsuarios();
  const id = params.id;
  let resultado: Result<User>;

  switch (body.accion) {
    case "asignarRol":
      if (!esRol(body.rol)) return badRequest("rol inválido");
      resultado = await uc.asignarRol(id, body.rol);
      break;
    case "revocarRol":
      if (!esRol(body.rol)) return badRequest("rol inválido");
      resultado = await uc.revocarRol(id, body.rol);
      break;
    case "puedeCobrar":
      if (typeof body.puedeCobrar !== "boolean")
        return badRequest("puedeCobrar debe ser boolean");
      resultado = await uc.establecerPuedeCobrar(id, body.puedeCobrar);
      break;
    case "nombre":
      if (typeof body.nombre !== "string")
        return badRequest("nombre debe ser string");
      resultado = await uc.editarNombre(id, body.nombre);
      break;
    case "activar":
      resultado = await uc.activar(id);
      break;
    case "desactivar":
      resultado = await uc.desactivar(id);
      break;
    default:
      return badRequest(
        "accion debe ser asignarRol, revocarRol, puedeCobrar, nombre, activar o desactivar",
      );
  }

  return respondResult(resultado, toUserDTO);
}

function esRol(v: unknown): v is Role {
  return typeof v === "string" && (Object.values(Role) as string[]).includes(v);
}
