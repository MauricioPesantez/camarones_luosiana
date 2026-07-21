import type { AuditEntryDTO } from "@/presentation/http/dto";

import { apiFetch } from "./client";

/** Filtros de consulta del registro de auditoría (R16.3). */
export interface AuditFiltro {
  usuario?: string;
  accion?: string;
  entidad?: string;
  desde?: string;
  hasta?: string;
}

/** `GET /api/audit` — historial de acciones sensibles (R16.3, R16.4, admin). */
export async function listarAuditoria(
  filtro: AuditFiltro = {},
): Promise<AuditEntryDTO[]> {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtro)) {
    if (valor) params.set(clave, valor);
  }
  const qs = params.toString();
  const { entries } = await apiFetch<{ entries: AuditEntryDTO[] }>(
    qs ? `/api/audit?${qs}` : "/api/audit",
  );
  return entries;
}
