import { NextResponse } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/infrastructure/auth/session";

export const runtime = "nodejs";

/**
 * `POST /api/auth/logout` (R1.5): cierra la sesión borrando la cookie. Reusa las
 * mismas opciones (`httpOnly`, `sameSite`, `path`, `secure`) con `maxAge: 0`
 * para que el navegador la expire de inmediato. Es idempotente: sin sesión
 * previa igualmente responde 200.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
