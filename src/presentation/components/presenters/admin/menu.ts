import type { MenuItemDTO } from "@/presentation/http/dto";

/**
 * Vista-modelo pura de la administración de menú (R3.1, R3.6). Sin React ni
 * DOM: formato, validación del formulario y textos de confirmación/toast. Se
 * prueba de forma aislada en Node (`menu.test.ts`).
 */

/** Borrador del formulario de plato (campos como texto, tal cual el input). */
export interface PlatoDraft {
  nombre: string;
  categoriaId: string;
  precio: string;
  stockDelDia: string;
  fotoUrl: string;
}

/** Borrador vacío para inicializar el formulario de creación. */
export const PLATO_DRAFT_VACIO: PlatoDraft = {
  nombre: "",
  categoriaId: "",
  precio: "",
  stockDelDia: "",
  fotoUrl: "",
};

/** Formatea un monto decimal a moneda (mismo formato que el resto de la app). */
export function formatMoney(monto: number): string {
  return `$${monto.toFixed(2)}`;
}

/** Etiqueta legible de la disponibilidad de un plato (R3.6). */
export function etiquetaDisponibilidad(item: MenuItemDTO): string {
  if (!item.disponible) return "No disponible";
  if (item.stockDelDia <= 0) return "Agotado";
  return "Disponible";
}

/**
 * ¿El borrador del plato es válido para crear/editar? (R3.1). Exige nombre y
 * categoría no vacíos, precio finito y positivo, y stock finito y no negativo.
 */
export function platoDraftValido(draft: PlatoDraft): boolean {
  const precio = Number(draft.precio);
  const stock = Number(draft.stockDelDia);
  return (
    draft.nombre.trim() !== "" &&
    draft.categoriaId.trim() !== "" &&
    draft.precio.trim() !== "" &&
    Number.isFinite(precio) &&
    precio > 0 &&
    draft.stockDelDia.trim() !== "" &&
    Number.isFinite(stock) &&
    stock >= 0
  );
}

/** Convierte un borrador válido en el payload numérico de creación. */
export function draftAPayload(draft: PlatoDraft): {
  nombre: string;
  categoriaId: string;
  precio: number;
  stockDelDia: number;
  fotoUrl: string | null;
} {
  return {
    nombre: draft.nombre.trim(),
    categoriaId: draft.categoriaId.trim(),
    precio: Number(draft.precio),
    stockDelDia: Number(draft.stockDelDia),
    fotoUrl: draft.fotoUrl.trim() || null,
  };
}

/** Proyecta un plato existente a un borrador editable. */
export function itemADraft(item: MenuItemDTO): PlatoDraft {
  return {
    nombre: item.nombre,
    categoriaId: item.categoriaId,
    precio: String(item.precio),
    stockDelDia: String(item.stockDelDia),
    fotoUrl: item.fotoUrl ?? "",
  };
}

/** Texto de confirmación de borrado de un plato (R3.1). */
export function mensajeConfirmarEliminar(nombre: string): string {
  return `Se eliminará el plato "${nombre}". ¿Continuar?`;
}

export const MENSAJE_PLATO_CREADO = "Plato creado";
export const MENSAJE_PLATO_EDITADO = "Plato actualizado";
export const MENSAJE_PLATO_ELIMINADO = "Plato eliminado";
export const MENSAJE_STOCK_ACTUALIZADO = "Stock actualizado";
