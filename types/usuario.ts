// Tipos relacionados con usuarios del sistema

export const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'mesero', label: 'Mesero' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'digital', label: 'Canal digital' },
] as const;

export type Rol = (typeof ROLES)[number]['value'];

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && ROLES.some((rol) => rol.value === valor);
}

export function obtenerEtiquetaRol(rol: string): string {
  return ROLES.find((opcion) => opcion.value === rol)?.label ?? rol;
}

/** Forma con la que el panel de administracion lee un usuario: nunca la clave. */
export interface UsuarioAdmin {
  id: string;
  nombre: string;
  rol: string;
  activo: boolean;
  tienePassword: boolean;
}

export function aUsuarioAdmin(usuario: {
  id: string;
  nombre: string;
  rol: string;
  activo: boolean;
  password: string | null;
}): UsuarioAdmin {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol,
    activo: usuario.activo,
    tienePassword: Boolean(usuario.password),
  };
}
