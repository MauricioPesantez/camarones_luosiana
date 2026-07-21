import { jwtVerify } from "jose";

import type { SessionUser } from "@/application/ports/AuthService";
import { Role } from "@/domain/user/Role";

/**
 * Nombre de la cookie de sesión. Único punto de verdad: lo consumen el route
 * handler de login (al emitir), el middleware (al verificar) y el futuro
 * logout (al limpiar).
 */
export const SESSION_COOKIE = "cl_session";

/**
 * Vida de la cookie en segundos (12h), alineada con el `expiresIn` del JWT que
 * emite `JwtAuthService`. Si el token expira antes que la cookie, la
 * verificación de firma falla y la sesión se trata como ausente.
 */
const SESSION_MAX_AGE = 12 * 60 * 60;

/**
 * Opciones de la cookie de sesión (R1.1). `httpOnly` la oculta a JavaScript,
 * `sameSite=strict` la restringe a navegación desde el propio sitio, y `secure`
 * la limita a HTTPS en producción (se relaja en desarrollo sobre http://localhost).
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

/**
 * Resuelve el secreto de firma como bytes para `jose`. Debe coincidir con el
 * `JWT_SECRET` que usa `JwtAuthService` (jsonwebtoken); ambos firman/verifican
 * el mismo token con HS256.
 */
function secretoEnBytes(): Uint8Array {
  const secreto = process.env.JWT_SECRET;
  if (!secreto) {
    throw new Error(
      "JWT_SECRET no está definido. Configúralo en las variables de entorno.",
    );
  }
  return new TextEncoder().encode(secreto);
}

/**
 * Verifica la firma y vigencia de un token de sesión en el **Edge Runtime**
 * (donde corre el middleware de Next). No puede usarse `JwtAuthService`, que
 * depende de `jsonwebtoken` (crypto de Node, no disponible en el edge); por eso
 * este verificador usa `jose`, compatible con edge. Ambos comparten secreto y
 * forma de payload, de modo que un token emitido por `JwtAuthService` se
 * verifica aquí sin diferencias.
 *
 * Devuelve el `SessionUser` reconstruido, o `null` si el token es inexistente,
 * malformado, con firma inválida, expirado o con un payload incompleto.
 */
export async function verifySessionEdge(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secretoEnBytes());

    const roles = payload.roles;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.usuario !== "string" ||
      typeof payload.nombre !== "string" ||
      typeof payload.puedeCobrar !== "boolean" ||
      !Array.isArray(roles) ||
      !roles.every((r): r is Role =>
        Object.values(Role).includes(r as Role),
      )
    ) {
      return null;
    }

    return {
      id: payload.sub,
      usuario: payload.usuario as string,
      nombre: payload.nombre as string,
      roles: roles as Role[],
      puedeCobrar: payload.puedeCobrar as boolean,
    };
  } catch {
    // Token inválido, malformado o expirado.
    return null;
  }
}
