/**
 * Vista-modelo pura de la navegación (R2.2). Sin React ni DOM: decide qué
 * enlaces ve cada usuario según su rol / permiso y cuál es su pantalla de
 * aterrizaje tras iniciar sesión. Se prueba de forma aislada en Node
 * (`nav.test.ts`).
 *
 * Las reglas de visibilidad replican el mapa de autorización del middleware
 * (`src/middleware.ts`): mostrar aquí un enlace que el middleware bloquearía
 * solo llevaría al usuario a un 403, por lo que ambos deben coincidir.
 */
import { Role } from "@/domain/user/Role";

/** Perfil mínimo necesario para decidir navegación (lo cumplen User/SessionUser DTO). */
export interface PerfilNav {
  roles: Role[];
  puedeCobrar: boolean;
}

/** Entrada de navegación con su regla de acceso (misma forma que el middleware). */
export interface NavEntry {
  href: string;
  label: string;
  /** Roles autorizados (cualquiera de ellos). Ausente = no restringe por rol. */
  roles?: Role[];
  /** Exige el flag `puedeCobrar`, independiente del rol (R2.3). */
  permiso?: "cobrar";
}

/**
 * Enlaces de navegación en orden de prioridad. El primero que un usuario puede
 * ver es también su pantalla de aterrizaje (`landingPara`), salvo el ADMIN que
 * aterriza en su panel. El orden coincide con el flujo operativo:
 * tomar orden → cocina → cobrar → caja → administración.
 */
export const NAV_ENTRIES: readonly NavEntry[] = [
  { href: "/orden", label: "Órdenes", roles: [Role.MESERO, Role.OPERADOR, Role.ADMIN] },
  { href: "/kds", label: "Cocina", roles: [Role.COCINA, Role.ADMIN] },
  { href: "/cobrar", label: "Cobrar", permiso: "cobrar" },
  { href: "/caja", label: "Caja", roles: [Role.ADMIN] },
  { href: "/admin", label: "Administración", roles: [Role.ADMIN] },
];

/** ¿El perfil satisface la regla de acceso de la entrada? */
export function puedeVer(perfil: PerfilNav, entry: NavEntry): boolean {
  if (entry.permiso === "cobrar" && !perfil.puedeCobrar) {
    return false;
  }
  if (entry.roles && !entry.roles.some((r) => perfil.roles.includes(r))) {
    return false;
  }
  return true;
}

/** Enlaces visibles para el perfil, en orden de prioridad. */
export function navPara(perfil: PerfilNav): NavEntry[] {
  return NAV_ENTRIES.filter((e) => puedeVer(perfil, e));
}

/**
 * Pantalla de aterrizaje tras el login. El ADMIN aterriza en su panel; el resto
 * en su primer enlace visible (su tarea principal). Sin enlaces (caso degenerado)
 * cae a la raíz.
 */
export function landingPara(perfil: PerfilNav): string {
  if (perfil.roles.includes(Role.ADMIN)) {
    return "/admin";
  }
  const primero = navPara(perfil)[0];
  return primero ? primero.href : "/";
}

/** ¿La ruta actual corresponde a (o cuelga de) el enlace? Para marcar activo. */
export function esRutaActiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
