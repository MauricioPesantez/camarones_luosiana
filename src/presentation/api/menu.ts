import type { MenuItemDTO } from "@/presentation/http/dto";

import { apiFetch } from "./client";

export interface CrearPlatoPayload {
  nombre: string;
  categoriaId: string;
  precio: number;
  stockDelDia: number;
  fotoUrl?: string | null;
  disponible?: boolean;
}

export interface EditarPlatoPayload {
  nombre?: string;
  categoriaId?: string;
  precio?: number;
  stockDelDia?: number;
  fotoUrl?: string | null;
  disponible?: boolean;
}

/** `GET /api/menu` — lista de platos. */
export async function listarMenu(): Promise<MenuItemDTO[]> {
  const { items } = await apiFetch<{ items: MenuItemDTO[] }>("/api/menu");
  return items;
}

/** `POST /api/menu` — crea un plato (R3.1, admin). */
export function crearPlato(payload: CrearPlatoPayload): Promise<MenuItemDTO> {
  return apiFetch<MenuItemDTO>("/api/menu", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** `PATCH /api/menu/[id]` — edita un plato (R3.1, admin). */
export function editarPlato(
  id: string,
  cambios: EditarPlatoPayload,
): Promise<MenuItemDTO> {
  return apiFetch<MenuItemDTO>(`/api/menu/${id}`, {
    method: "PATCH",
    body: JSON.stringify(cambios),
  });
}

/** `DELETE /api/menu/[id]` — elimina un plato (R3.1, admin). */
export function eliminarPlato(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/menu/${id}`, { method: "DELETE" });
}

/** `POST /api/menu/[id]/stock` — ajusta stock y/o disponibilidad (R3.6, admin). */
export function ajustarStock(
  id: string,
  cambios: { stock?: number; disponible?: boolean },
): Promise<MenuItemDTO> {
  return apiFetch<MenuItemDTO>(`/api/menu/${id}/stock`, {
    method: "POST",
    body: JSON.stringify(cambios),
  });
}
