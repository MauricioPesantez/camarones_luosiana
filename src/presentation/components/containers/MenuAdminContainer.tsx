"use client";

import { useCallback, useEffect, useState } from "react";

import type { MenuItemDTO } from "@/presentation/http/dto";
import { ApiError } from "@/presentation/api/client";
import {
  ajustarStock,
  crearPlato,
  editarPlato,
  eliminarPlato,
  listarMenu,
} from "@/presentation/api/menu";
import { useUI } from "@/presentation/components/ui";
import { useAdminGuard } from "@/presentation/hooks/useAdminGuard";
import { MenuAdminTable } from "@/presentation/components/presenters/admin/MenuAdminTable";
import { PlatoForm } from "@/presentation/components/presenters/admin/PlatoForm";
import {
  MENSAJE_PLATO_CREADO,
  MENSAJE_PLATO_EDITADO,
  MENSAJE_PLATO_ELIMINADO,
  MENSAJE_STOCK_ACTUALIZADO,
  PLATO_DRAFT_VACIO,
  type PlatoDraft,
  draftAPayload,
  itemADraft,
  mensajeConfirmarEliminar,
  platoDraftValido,
} from "@/presentation/components/presenters/admin/menu";

import { AdminGate } from "./AdminGate";

const MENSAJE_ERROR_GENERICO = "Ocurrió un error. Intenta de nuevo.";

/**
 * Container de administración de menú (R3.1, R3.6). Solo admin. Wirea el
 * formulario de creación/edición y la tabla con las operaciones de menú y
 * stock, usando `useUI` (confirmación de borrado, toasts) y refrescando la
 * lista tras cada mutación.
 */
export function MenuAdminContainer() {
  const guard = useAdminGuard();
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<MenuItemDTO[]>([]);
  const [draft, setDraft] = useState<PlatoDraft>(PLATO_DRAFT_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      setItems(await listarMenu());
    } catch {
      /* conserva la lista previa si falla la recarga */
    }
  }, []);

  useEffect(() => {
    if (guard.esAdmin) void refrescar();
  }, [guard.esAdmin, refrescar]);

  const manejarError = useCallback(
    (e: unknown) => {
      toast(e instanceof ApiError ? e.message : MENSAJE_ERROR_GENERICO);
    },
    [toast],
  );

  const setCampo = useCallback((campo: keyof PlatoDraft, valor: string) => {
    setDraft((d) => ({ ...d, [campo]: valor }));
  }, []);

  const cancelarEdicion = useCallback(() => {
    setEditandoId(null);
    setDraft(PLATO_DRAFT_VACIO);
  }, []);

  const guardar = useCallback(async () => {
    if (!platoDraftValido(draft)) return;
    setProcesando(true);
    try {
      const payload = draftAPayload(draft);
      if (editandoId) {
        await editarPlato(editandoId, payload);
        toast(MENSAJE_PLATO_EDITADO);
      } else {
        await crearPlato(payload);
        toast(MENSAJE_PLATO_CREADO);
      }
      cancelarEdicion();
      await refrescar();
    } catch (e) {
      manejarError(e);
    } finally {
      setProcesando(false);
    }
  }, [draft, editandoId, toast, cancelarEdicion, refrescar, manejarError]);

  const editar = useCallback((item: MenuItemDTO) => {
    setEditandoId(item.id);
    setDraft(itemADraft(item));
  }, []);

  const eliminar = useCallback(
    async (item: MenuItemDTO) => {
      const ok = await confirm({
        title: "Eliminar plato",
        message: mensajeConfirmarEliminar(item.nombre),
        danger: true,
        confirmLabel: "Eliminar",
      });
      if (!ok) return;
      try {
        await eliminarPlato(item.id);
        toast(MENSAJE_PLATO_ELIMINADO);
        if (editandoId === item.id) cancelarEdicion();
        await refrescar();
      } catch (e) {
        manejarError(e);
      }
    },
    [confirm, toast, editandoId, cancelarEdicion, refrescar, manejarError],
  );

  const toggleDisponible = useCallback(
    async (item: MenuItemDTO) => {
      try {
        await ajustarStock(item.id, { disponible: !item.disponible });
        await refrescar();
      } catch (e) {
        manejarError(e);
      }
    },
    [refrescar, manejarError],
  );

  const setStock = useCallback(
    async (item: MenuItemDTO, stock: number) => {
      try {
        await ajustarStock(item.id, { stock });
        toast(MENSAJE_STOCK_ACTUALIZADO);
        await refrescar();
      } catch (e) {
        manejarError(e);
      }
    },
    [toast, refrescar, manejarError],
  );

  return (
    <AdminGate guard={guard} titulo="Menú">
      <div className="grid gap-6 md:grid-cols-[20rem_1fr]">
        <PlatoForm
          draft={draft}
          onCampo={setCampo}
          onGuardar={guardar}
          onCancelar={cancelarEdicion}
          editando={editandoId !== null}
          puedeGuardar={platoDraftValido(draft)}
          procesando={procesando}
        />
        <MenuAdminTable
          items={items}
          onEditar={editar}
          onEliminar={eliminar}
          onToggleDisponible={toggleDisponible}
          onStock={setStock}
        />
      </div>
    </AdminGate>
  );
}
