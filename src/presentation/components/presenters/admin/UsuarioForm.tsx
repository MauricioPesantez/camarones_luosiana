"use client";

import { Role } from "@/domain/user/Role";

import { ETIQUETA_ROL, ROLES, type UsuarioDraft } from "./usuarios";

export interface UsuarioFormProps {
  readonly draft: UsuarioDraft;
  readonly onCampo: (campo: "usuario" | "nombre" | "clave", valor: string) => void;
  readonly onToggleRol: (rol: Role) => void;
  readonly onTogglePuedeCobrar: (valor: boolean) => void;
  readonly onCrear: () => void;
  readonly puedeCrear: boolean;
  readonly procesando?: boolean;
}

const INPUT =
  "min-h-[44px] rounded-md border border-input bg-background px-3 text-foreground";

/**
 * Formulario de creación de usuario (R2.1). Presentacional puro: captura
 * usuario, nombre, clave, roles y permiso de cobro. La clave la escribe el
 * administrador; el hash lo hace el servidor. Los toasts los orquesta el
 * container.
 */
export function UsuarioForm({
  draft,
  onCampo,
  onToggleRol,
  onTogglePuedeCobrar,
  onCrear,
  puedeCrear,
  procesando = false,
}: UsuarioFormProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-5">
      <h2 className="text-lg font-bold text-foreground">Nuevo usuario</h2>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Usuario
        <input
          type="text"
          autoComplete="off"
          value={draft.usuario}
          onChange={(e) => onCampo("usuario", e.target.value)}
          className={INPUT}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Nombre
        <input
          type="text"
          value={draft.nombre}
          onChange={(e) => onCampo("nombre", e.target.value)}
          className={INPUT}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Clave
        <input
          type="password"
          autoComplete="new-password"
          value={draft.clave}
          onChange={(e) => onCampo("clave", e.target.value)}
          className={INPUT}
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">Roles</legend>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((rol) => {
            const activo = draft.roles.includes(rol);
            return (
              <button
                key={rol}
                type="button"
                aria-pressed={activo}
                onClick={() => onToggleRol(rol)}
                className={
                  activo
                    ? "min-h-[44px] rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                    : "min-h-[44px] rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted"
                }
              >
                {ETIQUETA_ROL[rol]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={draft.puedeCobrar}
          onChange={(e) => onTogglePuedeCobrar(e.target.checked)}
          className="size-5"
        />
        Puede cobrar
      </label>

      <button
        type="button"
        onClick={onCrear}
        disabled={!puedeCrear || procesando}
        className="min-h-[44px] rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {procesando ? "Creando…" : "Crear usuario"}
      </button>
    </div>
  );
}
