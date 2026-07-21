"use client";

import { useCallback, useEffect, useState } from "react";

import { Role } from "@/domain/user/Role";
import type { UserDTO } from "@/presentation/http/dto";
import { ApiError } from "@/presentation/api/client";
import {
  activarUsuario,
  asignarRol,
  crearUsuario,
  desactivarUsuario,
  establecerPuedeCobrar,
  listarUsuarios,
  revocarRol,
} from "@/presentation/api/users";
import { useUI } from "@/presentation/components/ui";
import { useAdminGuard } from "@/presentation/hooks/useAdminGuard";
import { UsuarioForm } from "@/presentation/components/presenters/admin/UsuarioForm";
import { UsuariosTable } from "@/presentation/components/presenters/admin/UsuariosTable";
import {
  MENSAJE_USUARIO_CREADO,
  USUARIO_DRAFT_VACIO,
  type UsuarioDraft,
  alternarRol,
  mensajeConfirmarDesactivar,
  mensajeEstadoUsuario,
  tieneRol,
  usuarioDraftValido,
} from "@/presentation/components/presenters/admin/usuarios";

import { AdminGate } from "./AdminGate";

const MENSAJE_ERROR_GENERICO = "Ocurrió un error. Intenta de nuevo.";

/**
 * Container de gestión de usuarios (R2.1, R2.3, R2.6). Solo admin. Wirea la
 * creación y la tabla con toggles de rol, permiso de cobro y activación,
 * usando `useUI` (confirmación de desactivación, toasts) y refrescando la lista
 * tras cada mutación.
 */
export function UsuariosContainer() {
  const guard = useAdminGuard();
  const { toast, confirm } = useUI();
  const [usuarios, setUsuarios] = useState<UserDTO[]>([]);
  const [draft, setDraft] = useState<UsuarioDraft>(USUARIO_DRAFT_VACIO);
  const [procesando, setProcesando] = useState(false);

  const refrescar = useCallback(async () => {
    try {
      setUsuarios(await listarUsuarios());
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

  const setCampo = useCallback(
    (campo: "usuario" | "nombre" | "clave", valor: string) => {
      setDraft((d) => ({ ...d, [campo]: valor }));
    },
    [],
  );

  const toggleRolDraft = useCallback((rol: Role) => {
    setDraft((d) => ({ ...d, roles: alternarRol(d.roles, rol) }));
  }, []);

  const setPuedeCobrarDraft = useCallback((valor: boolean) => {
    setDraft((d) => ({ ...d, puedeCobrar: valor }));
  }, []);

  const crear = useCallback(async () => {
    if (!usuarioDraftValido(draft)) return;
    setProcesando(true);
    try {
      await crearUsuario({
        usuario: draft.usuario.trim(),
        nombre: draft.nombre.trim(),
        clave: draft.clave,
        roles: [...draft.roles],
        puedeCobrar: draft.puedeCobrar,
      });
      toast(MENSAJE_USUARIO_CREADO);
      setDraft(USUARIO_DRAFT_VACIO);
      await refrescar();
    } catch (e) {
      manejarError(e);
    } finally {
      setProcesando(false);
    }
  }, [draft, toast, refrescar, manejarError]);

  const toggleRol = useCallback(
    async (user: UserDTO, rol: Role) => {
      try {
        if (tieneRol(user, rol)) {
          await revocarRol(user.id, rol);
        } else {
          await asignarRol(user.id, rol);
        }
        await refrescar();
      } catch (e) {
        manejarError(e);
      }
    },
    [refrescar, manejarError],
  );

  const togglePuedeCobrar = useCallback(
    async (user: UserDTO) => {
      try {
        await establecerPuedeCobrar(user.id, !user.puedeCobrar);
        await refrescar();
      } catch (e) {
        manejarError(e);
      }
    },
    [refrescar, manejarError],
  );

  const toggleActivo = useCallback(
    async (user: UserDTO) => {
      if (user.activo) {
        const ok = await confirm({
          title: "Desactivar usuario",
          message: mensajeConfirmarDesactivar(user.nombre),
          danger: true,
          confirmLabel: "Desactivar",
        });
        if (!ok) return;
      }
      try {
        if (user.activo) {
          await desactivarUsuario(user.id);
        } else {
          await activarUsuario(user.id);
        }
        toast(mensajeEstadoUsuario(!user.activo));
        await refrescar();
      } catch (e) {
        manejarError(e);
      }
    },
    [confirm, toast, refrescar, manejarError],
  );

  return (
    <AdminGate guard={guard} titulo="Usuarios">
      <div className="grid gap-6 md:grid-cols-[20rem_1fr]">
        <UsuarioForm
          draft={draft}
          onCampo={setCampo}
          onToggleRol={toggleRolDraft}
          onTogglePuedeCobrar={setPuedeCobrarDraft}
          onCrear={crear}
          puedeCrear={usuarioDraftValido(draft)}
          procesando={procesando}
        />
        <UsuariosTable
          usuarios={usuarios}
          onToggleRol={toggleRol}
          onTogglePuedeCobrar={togglePuedeCobrar}
          onToggleActivo={toggleActivo}
        />
      </div>
    </AdminGate>
  );
}
