import { NextResponse, type NextRequest } from "next/server";

import type { SessionUser } from "@/application/ports/AuthService";
import { Role } from "@/domain/user/Role";
import { SESSION_COOKIE, verifySessionEdge } from "@/infrastructure/auth/session";

/** Ruta de la pantalla de login (destino de las redirecciones, R1.5). */
const LOGIN_PATH = "/login";

/**
 * Regla de acceso de una ruta. `roles` autoriza a cualquiera de esos roles;
 * `permiso: "cobrar"` exige el flag `puedeCobrar` (independiente del rol, R2.3).
 * Una regla vacía `{}` solo exige sesión válida (cualquier usuario autenticado).
 */
interface ReglaAcceso {
  roles?: Role[];
  permiso?: "cobrar";
}

/**
 * Mapa ruta → roles/permiso (R2.2, R2.5). Se evalúa por prefijo y en orden: la
 * primera entrada cuyo prefijo coincida con la ruta gana, por lo que las rutas
 * más específicas deben ir antes que las más generales.
 *
 * Las rutas concretas se afinarán en la Tarea 18 al montar cada pantalla; este
 * mapa refleja las pantallas del diseño (§Pantallas) y es la fuente única de
 * autorización a nivel de navegación.
 */
const REGLAS_RUTA: ReadonlyArray<readonly [string, ReglaAcceso]> = [
  ["/cobrar", { permiso: "cobrar" }],
  ["/kds", { roles: [Role.COCINA, Role.ADMIN] }],
  ["/cocina", { roles: [Role.COCINA, Role.ADMIN] }],
  ["/caja", { roles: [Role.ADMIN] }],
  ["/admin", { roles: [Role.ADMIN] }],
  ["/menu", { roles: [Role.ADMIN] }],
  ["/usuarios", { roles: [Role.ADMIN] }],
  ["/auditoria", { roles: [Role.ADMIN] }],
  ["/orden", { roles: [Role.MESERO, Role.OPERADOR, Role.ADMIN] }],
  ["/", { roles: [Role.MESERO, Role.OPERADOR, Role.COCINA, Role.ADMIN] }],
];

/** Rutas públicas: no requieren sesión. */
const RUTAS_PUBLICAS = [LOGIN_PATH, "/api/auth/login", "/api/auth/logout"];

export function esRutaPublica(path: string): boolean {
  return RUTAS_PUBLICAS.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Resuelve la regla de acceso de una ruta: primer prefijo que coincide, en el
 * orden del mapa. El prefijo `"/"` actúa como catch-all para cualquier usuario
 * autenticado y por eso va al final de `REGLAS_RUTA`.
 */
export function reglaDe(path: string): ReglaAcceso | null {
  for (const [prefijo, regla] of REGLAS_RUTA) {
    if (prefijo === "/") {
      return regla;
    }
    if (path === prefijo || path.startsWith(`${prefijo}/`)) {
      return regla;
    }
  }
  return null;
}

/** Indica si el usuario satisface la regla de acceso. */
export function autorizado(user: SessionUser, regla: ReglaAcceso): boolean {
  if (regla.permiso === "cobrar" && !user.puedeCobrar) {
    return false;
  }
  if (regla.roles && !regla.roles.some((r) => user.roles.includes(r))) {
    return false;
  }
  return true;
}

/**
 * Middleware de protección de rutas (R1.5, R2.2, R2.5).
 *
 * Verifica la firma de la cookie de sesión en el edge (`verifySessionEdge`) y
 * aplica el mapa ruta → roles. Sin sesión válida redirige al login (páginas) o
 * responde 401 (API); con sesión pero sin el rol/permiso requerido responde 403.
 *
 * Es la primera capa de una defensa en profundidad: los casos de uso revalidan
 * las acciones sensibles (Property 8), de modo que la seguridad no depende solo
 * de esta comprobación HTTP.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (esRutaPublica(pathname)) {
    return NextResponse.next();
  }

  const esApi = pathname.startsWith("/api/");
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionEdge(token);

  // Sin sesión válida: redirige al login (páginas) o 401 (API) (R1.5).
  if (!session) {
    if (esApi) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Sesión válida: aplica la regla de la ruta (R2.2, R2.5).
  const regla = reglaDe(pathname);
  if (regla && !autorizado(session, regla)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  return NextResponse.next();
}

/**
 * El middleware corre en todas las rutas salvo los estáticos de Next, el favicon
 * y la propia API de login (pública). Las reglas de autorización se resuelven
 * dentro de `middleware`.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/login).*)"],
};
