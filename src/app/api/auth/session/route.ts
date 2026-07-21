import { NextResponse } from "next/server";

import { getSessionUser } from "@/presentation/http/apiSession";
import { toSessionUserDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `GET /api/auth/session`: devuelve el usuario de la sesión actual, o `null` si
 * no hay sesión. La cookie es `httpOnly`, así que el cliente no puede leer el
 * JWT; este endpoint expone los datos mínimos (incl. `puedeCobrar`) para
 * decidir qué mostrar en la UI (p. ej. la pestaña "Cobrar", R2.3).
 */
export async function GET(request: Request) {
  const session = await getSessionUser(request);
  return NextResponse.json({
    user: session ? toSessionUserDTO(session) : null,
  });
}
