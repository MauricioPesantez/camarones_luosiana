import type { Role } from "@/domain/user/Role";
import type { UserDTO } from "@/presentation/http/dto";

import { apiFetch } from "./client";

export interface CrearUsuarioPayload {
  usuario: string;
  nombre: string;
  clave: string;
  roles: Role[];
  puedeCobrar?: boolean;
}

/** `GET /api/users` — lista de usuarios (R2.6, admin). */
export async function listarUsuarios(): Promise<UserDTO[]> {
  const { users } = await apiFetch<{ users: UserDTO[] }>("/api/users");
  return users;
}

/** `POST /api/users` — crea un usuario (R2.1, R2.6, admin). */
export function crearUsuario(payload: CrearUsuarioPayload): Promise<UserDTO> {
  return apiFetch<UserDTO>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** `PATCH /api/users/[id]` — asigna un rol (R2.6, admin). */
export function asignarRol(id: string, rol: Role): Promise<UserDTO> {
  return patch(id, { accion: "asignarRol", rol });
}

/** `PATCH /api/users/[id]` — revoca un rol (R2.6, admin). */
export function revocarRol(id: string, rol: Role): Promise<UserDTO> {
  return patch(id, { accion: "revocarRol", rol });
}

/** `PATCH /api/users/[id]` — fuerza el permiso de cobro (R2.3, R2.6, admin). */
export function establecerPuedeCobrar(
  id: string,
  puedeCobrar: boolean,
): Promise<UserDTO> {
  return patch(id, { accion: "puedeCobrar", puedeCobrar });
}

/** `PATCH /api/users/[id]` — activa el usuario (R2.6, admin). */
export function activarUsuario(id: string): Promise<UserDTO> {
  return patch(id, { accion: "activar" });
}

/** `PATCH /api/users/[id]` — desactiva el usuario (R2.6, admin). */
export function desactivarUsuario(id: string): Promise<UserDTO> {
  return patch(id, { accion: "desactivar" });
}

function patch(id: string, body: Record<string, unknown>): Promise<UserDTO> {
  return apiFetch<UserDTO>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
