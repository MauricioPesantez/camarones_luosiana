import { NextResponse } from "next/server";

import { CREDENCIALES_INVALIDAS } from "@/application/use-cases/auth/Login";
import { getLogin } from "@/infrastructure/di/container";
import { SESSION_COOKIE, sessionCookieOptions } from "@/infrastructure/auth/session";
import { isErr } from "@/domain/shared/Result";

/**
 * El login usa `JwtAuthService` (jsonwebtoken + bcrypt) y el repositorio Prisma,
 * ninguno compatible con el Edge Runtime. Se fuerza el runtime de Node.
 */
export const runtime = "nodejs";

/** Cuerpo esperado del login. */
interface LoginBody {
  usuario?: unknown;
  clave?: unknown;
}

/**
 * `POST /api/auth/login` (R1.1, R1.2, R1.3).
 *
 * Valida las credenciales vía el caso de uso `Login` y, si son correctas, emite
 * la cookie de sesión firmada (`httpOnly`, `secure` en producción,
 * `sameSite=strict`) y devuelve los datos públicos del usuario. Ante
 * credenciales inválidas responde 401 con un mensaje genérico, sin revelar si
 * el usuario existe o la clave es incorrecta.
 */
export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { error: "Cuerpo de la solicitud inválido" },
      { status: 400 },
    );
  }

  if (typeof body.usuario !== "string" || typeof body.clave !== "string") {
    return NextResponse.json(
      { error: "Usuario y clave son requeridos" },
      { status: 400 },
    );
  }

  const resultado = await getLogin().ejecutar({
    usuario: body.usuario,
    clave: body.clave,
  });

  if (isErr(resultado)) {
    // Credenciales inválidas o cuenta inactiva → 401 con mensaje genérico.
    const status = resultado.error.code === CREDENCIALES_INVALIDAS ? 401 : 403;
    return NextResponse.json({ error: resultado.error.message }, { status });
  }

  const { token, usuario } = resultado.value;
  const response = NextResponse.json({ usuario });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
