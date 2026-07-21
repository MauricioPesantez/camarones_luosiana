"use client";

import type { MenuItemDTO } from "@/presentation/http/dto";

import { puedeAgregarPlato } from "./orderTaking";

export interface MenuGridProps {
  readonly items: readonly MenuItemDTO[];
  readonly onAgregar: (item: MenuItemDTO) => void;
  /** Deshabilita todo el grid mientras la orden no admite edición. */
  readonly disabled?: boolean;
}

/**
 * Grid de platos con disponibilidad (R3, R5.1). Presentacional puro: no hace
 * fetching ni conoce la orden; solo pinta el menú y emite `onAgregar`. Un plato
 * sin stock o no disponible se muestra deshabilitado con su motivo.
 */
export function MenuGrid({ items, onAgregar, disabled = false }: MenuGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const agregable = !disabled && puedeAgregarPlato(item);
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={!agregable}
              onClick={() => onAgregar(item)}
              className="flex min-h-[44px] w-full flex-col items-start gap-1 rounded-lg border border-input p-3 text-left enabled:hover:border-primary enabled:hover:bg-muted disabled:opacity-50"
            >
              <span className="font-medium text-foreground">{item.nombre}</span>
              <span className="text-sm text-muted-foreground">
                ${item.precio.toFixed(2)}
              </span>
              {!item.disponible ? (
                <span className="text-xs text-destructive">No disponible</span>
              ) : item.stockDelDia <= 0 ? (
                <span className="text-xs text-destructive">Agotado</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Stock: {item.stockDelDia}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
