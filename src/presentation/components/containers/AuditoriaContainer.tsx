"use client";

import { useCallback, useEffect, useState } from "react";

import type { AuditEntryDTO } from "@/presentation/http/dto";
import { ApiError } from "@/presentation/api/client";
import { type AuditFiltro, listarAuditoria } from "@/presentation/api/audit";
import { useUI } from "@/presentation/components/ui";
import { useAdminGuard } from "@/presentation/hooks/useAdminGuard";
import { AuditFiltroBar } from "@/presentation/components/presenters/admin/AuditFiltroBar";
import { AuditTable } from "@/presentation/components/presenters/admin/AuditTable";

import { AdminGate } from "./AdminGate";

const MENSAJE_ERROR_GENERICO = "Ocurrió un error. Intenta de nuevo.";

/**
 * Container de la consulta de auditoría (R16.2, R16.3, R16.4). Solo admin: el
 * endpoint restringe la consulta al rol admin y aquí se revalida para la UI.
 * Carga el historial y lo filtra por usuario, acción, entidad y rango de fecha.
 */
export function AuditoriaContainer() {
  const guard = useAdminGuard();
  const { toast } = useUI();
  const [entries, setEntries] = useState<AuditEntryDTO[]>([]);
  const [filtro, setFiltro] = useState<AuditFiltro>({});
  const [cargando, setCargando] = useState(false);

  const buscar = useCallback(
    async (f: AuditFiltro) => {
      setCargando(true);
      try {
        setEntries(await listarAuditoria(f));
      } catch (e) {
        toast(e instanceof ApiError ? e.message : MENSAJE_ERROR_GENERICO);
      } finally {
        setCargando(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (guard.esAdmin) void buscar({});
  }, [guard.esAdmin, buscar]);

  const setCampo = useCallback((campo: keyof AuditFiltro, valor: string) => {
    setFiltro((f) => ({ ...f, [campo]: valor }));
  }, []);

  const limpiar = useCallback(() => {
    setFiltro({});
    void buscar({});
  }, [buscar]);

  return (
    <AdminGate guard={guard} titulo="Auditoría">
      <div className="flex flex-col gap-4">
        <AuditFiltroBar
          filtro={filtro}
          onCampo={setCampo}
          onBuscar={() => void buscar(filtro)}
          onLimpiar={limpiar}
          cargando={cargando}
        />
        <AuditTable entries={entries} />
      </div>
    </AdminGate>
  );
}
