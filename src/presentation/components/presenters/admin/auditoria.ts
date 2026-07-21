import type { AuditEntryDTO } from "@/presentation/http/dto";

/**
 * Vista-modelo pura de la consulta de auditoría (R16.2, R16.3). Sin React ni
 * DOM: formato de fecha, etiquetas de acción y resumen del detalle. Se prueba
 * de forma aislada en Node (`auditoria.test.ts`).
 */

/** Etiqueta legible de las acciones sensibles conocidas (R16.2). */
export const ETIQUETA_ACCION: Record<string, string> = {
  CANCELAR_ORDEN: "Cancelar orden",
  CERRAR_CAJA: "Cerrar caja",
  ABRIR_CAJA: "Abrir caja",
  COBRAR_ORDEN: "Cobrar orden",
  AJUSTAR_STOCK: "Ajustar stock",
};

/** Devuelve la etiqueta legible de una acción, o el código crudo si no se conoce. */
export function etiquetaAccion(accion: string): string {
  return ETIQUETA_ACCION[accion] ?? accion;
}

/** Formatea el timestamp ISO de una entrada a fecha/hora local legible. */
export function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Resume el `detalle` (JSON arbitrario) de una entrada en una línea `k: v`
 * legible. Devuelve cadena vacía si no hay detalle. No muta el objeto.
 */
export function resumenDetalle(detalle: AuditEntryDTO["detalle"]): string {
  if (!detalle || typeof detalle !== "object") return "";
  const entradas = Object.entries(detalle as Record<string, unknown>);
  if (entradas.length === 0) return "";
  return entradas
    .map(([clave, valor]) => `${clave}: ${formatearValor(valor)}`)
    .join(" · ");
}

function formatearValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}
