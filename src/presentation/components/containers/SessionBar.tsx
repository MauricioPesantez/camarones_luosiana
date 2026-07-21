"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { SessionUserDTO } from "@/presentation/http/dto";
import { cerrarSesion, sesionActual } from "@/presentation/api/auth";
import {
  esRutaActiva,
  navPara,
} from "@/presentation/components/presenters/nav/nav";

/**
 * Barra de sesión y navegación global (R1.5, R2.2): muestra los enlaces que el
 * usuario puede ver según su rol/permiso, el usuario activo y el botón de cerrar
 * sesión. Se monta en el layout y se oculta cuando no hay sesión o en la propia
 * pantalla de login. Los enlaces replican el mapa de autorización del middleware,
 * por lo que nunca ofrecen una ruta que terminaría en 403.
 *
 * Al salir borra la cookie y recarga a `/login` con una recarga dura para que el
 * middleware (edge) vea la cookie ya expirada.
 */
export function SessionBar() {
  const pathname = usePathname();
  const [usuario, setUsuario] = useState<SessionUserDTO | null>(null);

  useEffect(() => {
    let vigente = true;
    sesionActual()
      .then((u) => vigente && setUsuario(u))
      .catch(() => vigente && setUsuario(null));
    return () => {
      vigente = false;
    };
  }, [pathname]);

  const salir = useCallback(async () => {
    try {
      await cerrarSesion();
    } finally {
      window.location.assign("/login");
    }
  }, []);

  if (!usuario || pathname === "/login") return null;

  const enlaces = navPara(usuario);

  return (
    <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-background px-4 py-2">
      <nav className="flex flex-1 flex-wrap items-center gap-1">
        {enlaces.map((e) => {
          const activo = esRutaActiva(pathname, e.href);
          return (
            <Link
              key={e.href}
              href={e.href}
              aria-current={activo ? "page" : undefined}
              className={[
                "inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium",
                activo
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
              ].join(" ")}
            >
              {e.label}
            </Link>
          );
        })}
      </nav>
      <span className="text-sm text-muted-foreground">
        {usuario.nombre}{" "}
        <span className="text-xs">({usuario.usuario})</span>
      </span>
      <button
        type="button"
        onClick={salir}
        className="min-h-[44px] rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted"
      >
        Cerrar sesión
      </button>
    </header>
  );
}
