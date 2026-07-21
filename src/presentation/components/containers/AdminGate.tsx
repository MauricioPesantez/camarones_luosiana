"use client";

import type { ReactNode } from "react";

import type { AdminGuard } from "@/presentation/hooks/useAdminGuard";

export interface AdminGateProps {
  readonly guard: AdminGuard;
  readonly titulo: string;
  readonly children: ReactNode;
}

/**
 * Envoltura de las pantallas de administración (R2.5). Muestra el estado de
 * carga o un aviso de permiso mientras no se confirme el rol admin, y solo
 * entonces renderiza el contenido con su título. Centraliza el gateado de UI
 * que comparten Menú, Usuarios y Auditoría.
 */
export function AdminGate({ guard, titulo, children }: AdminGateProps) {
  if (guard.cargando) {
    return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  }

  if (!guard.esAdmin) {
    return (
      <p className="p-8 text-center text-muted-foreground">
        Requiere rol de administrador.
      </p>
    );
  }

  return (
    <section className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-xl font-bold text-foreground">{titulo}</h1>
      {children}
    </section>
  );
}
