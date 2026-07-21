import { Role } from "@/domain/user/Role";
import type { UserDTO } from "@/presentation/http/dto";

/**
 * Vista-modelo pura de la gestión de usuarios (R2.1, R2.3, R2.6). Sin React ni
 * DOM: catálogo de roles, validación del formulario y textos de toast. Se
 * prueba de forma aislada en Node (`usuarios.test.ts`).
 */

/** Etiqueta legible de cada rol (R2.1). */
export const ETIQUETA_ROL: Record<Role, string> = {
  [Role.MESERO]: "Mesero",
  [Role.COCINA]: "Cocina",
  [Role.OPERADOR]: "Operador",
  [Role.ADMIN]: "Administrador",
};

/** Roles asignables, en orden de presentación. */
export const ROLES: readonly Role[] = [
  Role.MESERO,
  Role.COCINA,
  Role.OPERADOR,
  Role.ADMIN,
];

/** Borrador del formulario de creación de usuario. */
export interface UsuarioDraft {
  usuario: string;
  nombre: string;
  clave: string;
  roles: readonly Role[];
  puedeCobrar: boolean;
}

/** Borrador vacío para inicializar el formulario. */
export const USUARIO_DRAFT_VACIO: UsuarioDraft = {
  usuario: "",
  nombre: "",
  clave: "",
  roles: [],
  puedeCobrar: false,
};

/** ¿El usuario tiene el rol dado? */
export function tieneRol(user: UserDTO, rol: Role): boolean {
  return user.roles.includes(rol);
}

/** Etiqueta resumida de los roles de un usuario. */
export function resumenRoles(user: UserDTO): string {
  if (user.roles.length === 0) return "Sin roles";
  return user.roles.map((r) => ETIQUETA_ROL[r]).join(", ");
}

/**
 * ¿El borrador es válido para crear un usuario? (R2.1). Exige usuario, nombre y
 * clave no vacíos y al menos un rol.
 */
export function usuarioDraftValido(draft: UsuarioDraft): boolean {
  return (
    draft.usuario.trim() !== "" &&
    draft.nombre.trim() !== "" &&
    draft.clave.trim() !== "" &&
    draft.roles.length > 0
  );
}

/** Alterna la pertenencia de un rol en una lista (para el formulario). */
export function alternarRol(
  roles: readonly Role[],
  rol: Role,
): readonly Role[] {
  return roles.includes(rol)
    ? roles.filter((r) => r !== rol)
    : [...roles, rol];
}

export const MENSAJE_USUARIO_CREADO = "Usuario creado";

/** Toast tras cambiar el estado activo/inactivo de un usuario (R2.6). */
export function mensajeEstadoUsuario(activo: boolean): string {
  return activo ? "Usuario activado" : "Usuario desactivado";
}

/** Texto de confirmación al desactivar un usuario (R2.6). */
export function mensajeConfirmarDesactivar(nombre: string): string {
  return `Se desactivará a "${nombre}" y no podrá iniciar sesión. ¿Continuar?`;
}
