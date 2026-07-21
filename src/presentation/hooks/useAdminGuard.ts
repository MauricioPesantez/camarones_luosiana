"use client";

import { useEffect, useState } from "react";

import { Role } from "@/domain/user/Role";
import type { SessionUserDTO } from "@/presentation/http/dto";
import { sesionActual } from "@/presentation/api/auth";

export interface AdminGuard {
  /** `undefined` mientras carga la sesión; luego el usuario o `null`. */
  usuario: SessionUserDTO | null | undefined;
  /** `true` solo cuando la sesión ya cargó y el usuario es admin. */
  esAdmin: boolean;
  /** `true` mientras se resuelve la sesión. */
  cargando: boolean;
}

/**
 * Revalida en cliente que el usuario de la sesión sea admin (R2.5, defensa en
 * profundidad sobre el middleware). Lo usan las pantallas de administración
 * para mostrar el contenido, un aviso de permiso o el estado de carga.
 */
export function useAdminGuard(): AdminGuard {
  const [usuario, setUsuario] = useState<SessionUserDTO | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let vigente = true;
    sesionActual()
      .then((u) => {
        if (vigente) setUsuario(u);
      })
      .catch(() => {
        if (vigente) setUsuario(null);
      });
    return () => {
      vigente = false;
    };
  }, []);

  return {
    usuario,
    esAdmin: usuario?.roles.includes(Role.ADMIN) ?? false,
    cargando: usuario === undefined,
  };
}
