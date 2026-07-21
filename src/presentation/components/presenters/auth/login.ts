/**
 * Vista-modelo pura del login (R1.1, R1.5). Sin React ni DOM: validación del
 * formulario y saneamiento del destino de redirección. Se prueba de forma
 * aislada en Node (`login.test.ts`).
 */

/** Destino por defecto tras iniciar sesión. */
export const REDIRECT_POR_DEFECTO = "/";

/** ¿El formulario tiene usuario y clave no vacíos? */
export function puedeIniciar(usuario: string, clave: string): boolean {
  return usuario.trim() !== "" && clave !== "";
}

/**
 * Sanea el parámetro `redirect` para prevenir open-redirect (R1.5). Solo admite
 * rutas internas absolutas (`/algo`); rechaza URLs absolutas (`http://…`),
 * protocol-relative (`//host`) y valores vacíos, devolviendo el destino por
 * defecto. Así el login nunca reenvía a un host externo controlado por el
 * atacante mediante el querystring.
 */
export function redirectSeguro(destino: string | null | undefined): string {
  if (!destino) return REDIRECT_POR_DEFECTO;
  if (!destino.startsWith("/")) return REDIRECT_POR_DEFECTO;
  if (destino.startsWith("//")) return REDIRECT_POR_DEFECTO;
  return destino;
}

/** Mensaje genérico ante un error de red inesperado (no de credenciales). */
export const MENSAJE_ERROR_GENERICO =
  "No se pudo iniciar sesión. Intenta de nuevo.";
