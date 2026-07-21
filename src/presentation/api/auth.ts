import type { SessionUserDTO, UserDTO } from "@/presentation/http/dto";

import { apiFetch } from "./client";

/** `GET /api/auth/session` — usuario actual o `null` (R2.3). */
export async function sesionActual(): Promise<SessionUserDTO | null> {
  const { user } = await apiFetch<{ user: SessionUserDTO | null }>(
    "/api/auth/session",
  );
  return user;
}

/**
 * `POST /api/auth/login` (R1.1) — valida credenciales; en éxito el servidor
 * fija la cookie de sesión `httpOnly` y devuelve los datos públicos del usuario.
 * Ante credenciales inválidas `apiFetch` lanza `ApiError` (401) con el mensaje
 * genérico del servidor.
 */
export async function iniciarSesion(
  usuario: string,
  clave: string,
): Promise<UserDTO> {
  const { usuario: user } = await apiFetch<{ usuario: UserDTO }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ usuario, clave }) },
  );
  return user;
}

/** `POST /api/auth/logout` (R1.5) — borra la cookie de sesión. Idempotente. */
export async function cerrarSesion(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}
