import { NextResponse } from "next/server";

import { DomainError } from "@/domain/shared/DomainError";
import { CREDENCIALES_INVALIDAS } from "@/application/use-cases/auth/Login";

/**
 * Traduce el `code` de un `DomainError` a un status HTTP (design.md §Error
 * Handling). El dominio no conoce HTTP: expone códigos estables y esta capa los
 * mapea. La convención se basa en el sufijo/segmento del código:
 *
 * - `*_NO_ENCONTRAD*` → 404 (entidad inexistente).
 * - `*_NO_AUTORIZADO`, `*_REQUIERE_ADMIN` → 403 (autenticado pero sin permiso).
 * - credenciales inválidas / cuenta inactiva → 401.
 * - cualquier otra violación de regla de negocio (incl. transición inválida
 *   R6.7) → 422.
 */
export function statusDeCodigo(code: string): number {
  if (code.includes("NO_ENCONTRAD")) {
    return 404;
  }
  if (code.includes("NO_AUTORIZADO") || code.includes("REQUIERE_ADMIN")) {
    return 403;
  }
  if (code === CREDENCIALES_INVALIDAS || code === "AUTH_USUARIO_INACTIVO") {
    return 401;
  }
  return 422;
}

/** Construye la respuesta de error a partir de un `DomainError`. */
export function errorResponse(error: DomainError): NextResponse {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: statusDeCodigo(error.code) },
  );
}

/** Respuesta 403 estándar para denegaciones de autorización en el handler. */
export function forbidden(mensaje = "No autorizado"): NextResponse {
  return NextResponse.json(
    { error: mensaje, code: "FORBIDDEN" },
    { status: 403 },
  );
}

/** Respuesta 401 estándar para peticiones sin sesión válida. */
export function unauthorized(mensaje = "No autenticado"): NextResponse {
  return NextResponse.json(
    { error: mensaje, code: "UNAUTHENTICATED" },
    { status: 401 },
  );
}

/** Respuesta 400 estándar para cuerpos/parámetros inválidos. */
export function badRequest(mensaje: string): NextResponse {
  return NextResponse.json(
    { error: mensaje, code: "BAD_REQUEST" },
    { status: 400 },
  );
}
