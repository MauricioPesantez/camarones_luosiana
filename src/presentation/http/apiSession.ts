import type { SessionUser } from "@/application/ports/AuthService";
import type { User } from "@/domain/user/User";
import { Role } from "@/domain/user/Role";
import { SESSION_COOKIE } from "@/infrastructure/auth/session";
import { getAuthService, getUserRepository } from "@/infrastructure/di/container";

import { forbidden, unauthorized } from "./apiError";
import { NextResponse } from "next/server";

/**
 * Helpers de sesión para route handlers (Node Runtime).
 *
 * A diferencia del middleware (edge, `verifySessionEdge` con `jose`), aquí se
 * corre en Node y se reutiliza `AuthService.verificarSesion` (jsonwebtoken) del
 * contenedor. Los handlers revalidan la autorización aunque el middleware ya la
 * haya comprobado: defensa en profundidad (Property 8).
 */

/** Lee y verifica la cookie de sesión. Devuelve el `SessionUser` o `null`. */
export async function getSessionUser(
  request: Request,
): Promise<SessionUser | null> {
  const token = leerCookie(request, SESSION_COOKIE);
  if (!token) {
    return null;
  }
  return getAuthService().verificarSesion(token);
}

/**
 * Exige una sesión válida. Devuelve el `SessionUser` o una `NextResponse` 401.
 * El caller debe comprobar `instanceof NextResponse` y retornarla si aplica.
 */
export async function requireSession(
  request: Request,
): Promise<SessionUser | NextResponse> {
  const session = await getSessionUser(request);
  return session ?? unauthorized();
}

/**
 * Exige una sesión con rol admin. Devuelve el `SessionUser` o una `NextResponse`
 * (401 sin sesión, 403 sin rol admin). Cubre las acciones sensibles y las
 * consultas restringidas (R2.5, R16.4).
 */
export async function requireAdmin(
  request: Request,
): Promise<SessionUser | NextResponse> {
  const session = await getSessionUser(request);
  if (!session) {
    return unauthorized();
  }
  if (!session.roles.includes(Role.ADMIN)) {
    return forbidden("Requiere rol de administrador");
  }
  return session;
}

/**
 * Carga la entidad de dominio `User` del actor de la sesión. Necesaria para los
 * casos de uso de caja, que reciben un `User` (con `esAdmin()`) en vez del
 * `SessionUser` plano. Devuelve `null` si el usuario ya no existe.
 */
export async function cargarUsuarioDominio(
  session: SessionUser,
): Promise<User | null> {
  return getUserRepository().obtener(session.id);
}

/** Extrae el valor de una cookie del header `Cookie` de la petición. */
function leerCookie(request: Request, nombre: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) {
    return undefined;
  }
  for (const parte of header.split(";")) {
    const [clave, ...resto] = parte.trim().split("=");
    if (clave === nombre) {
      return decodeURIComponent(resto.join("="));
    }
  }
  return undefined;
}
