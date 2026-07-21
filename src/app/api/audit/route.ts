import { NextResponse } from "next/server";

import type { AuditFiltro } from "@/application/ports/AuditRepository";
import { getAuditRepository } from "@/infrastructure/di/container";
import { requireAdmin } from "@/presentation/http/apiSession";
import { toAuditEntryDTO } from "@/presentation/http/serializers";

export const runtime = "nodejs";

/**
 * `GET /api/audit` (R16.3, R16.4).
 *
 * Historial de acciones sensibles. Solo admin (`requireAdmin` → 403 en otro
 * caso, R16.4). Acepta filtros opcionales por query: `usuario`, `accion`,
 * `entidad`, `desde`, `hasta`.
 */
export async function GET(request: Request) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const url = new URL(request.url);
  const filtro: AuditFiltro = {};
  const usuarioId = url.searchParams.get("usuario");
  const accion = url.searchParams.get("accion");
  const entidadTipo = url.searchParams.get("entidad");
  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  if (usuarioId) filtro.usuarioId = usuarioId;
  if (accion) filtro.accion = accion;
  if (entidadTipo) filtro.entidadTipo = entidadTipo;
  if (desde) filtro.desde = new Date(desde);
  if (hasta) filtro.hasta = new Date(hasta);

  const entradas = await getAuditRepository().listar(filtro);
  return NextResponse.json({ entries: entradas.map(toAuditEntryDTO) });
}
