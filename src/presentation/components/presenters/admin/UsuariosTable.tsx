"use client";

import { Role } from "@/domain/user/Role";
import type { UserDTO } from "@/presentation/http/dto";

import { ETIQUETA_ROL, ROLES } from "./usuarios";

export interface UsuariosTableProps {
  readonly usuarios: readonly UserDTO[];
  readonly onToggleRol: (user: UserDTO, rol: Role) => void;
  readonly onTogglePuedeCobrar: (user: UserDTO) => void;
  readonly onToggleActivo: (user: UserDTO) => void;
}

/**
 * Tabla de gestión de usuarios (R2.6). Presentacional puro: por cada usuario
 * muestra sus roles como toggles, el permiso de cobro y el estado activo, y
 * emite los cambios. La confirmación de desactivación y los toasts los orquesta
 * el container.
 */
export function UsuariosTable({
  usuarios,
  onToggleRol,
  onTogglePuedeCobrar,
  onToggleActivo,
}: UsuariosTableProps) {
  if (usuarios.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay usuarios.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {usuarios.map((user) => (
        <li
          key={user.id}
          className={
            user.activo
              ? "rounded-md border border-border p-4"
              : "rounded-md border border-dashed border-border p-4 opacity-60"
          }
        >
          <div className="mb-3 flex items-baseline justify-between">
            <div>
              <p className="font-medium text-foreground">{user.nombre}</p>
              <p className="text-xs text-muted-foreground">@{user.usuario}</p>
            </div>
            <button
              type="button"
              onClick={() => onToggleActivo(user)}
              className="min-h-[44px] rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              {user.activo ? "Desactivar" : "Activar"}
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {ROLES.map((rol) => {
              const activo = user.roles.includes(rol);
              return (
                <button
                  key={rol}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => onToggleRol(user, rol)}
                  className={
                    activo
                      ? "min-h-[44px] rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                      : "min-h-[44px] rounded-md border border-input px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
                  }
                >
                  {ETIQUETA_ROL[rol]}
                </button>
              );
            })}
          </div>

          <label className="flex min-h-[44px] items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={user.puedeCobrar}
              onChange={() => onTogglePuedeCobrar(user)}
              className="size-5"
            />
            Puede cobrar
          </label>
        </li>
      ))}
    </ul>
  );
}
