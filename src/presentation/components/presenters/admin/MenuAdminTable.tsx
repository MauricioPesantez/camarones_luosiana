"use client";

import type { MenuItemDTO } from "@/presentation/http/dto";

import { etiquetaDisponibilidad, formatMoney } from "./menu";

export interface MenuAdminTableProps {
  readonly items: readonly MenuItemDTO[];
  readonly onEditar: (item: MenuItemDTO) => void;
  readonly onEliminar: (item: MenuItemDTO) => void;
  readonly onToggleDisponible: (item: MenuItemDTO) => void;
  readonly onStock: (item: MenuItemDTO, stock: number) => void;
}

/**
 * Tabla de administración de menú (R3.1, R3.6). Presentacional puro: lista los
 * platos con su disponibilidad y expone editar, eliminar, forzar
 * disponibilidad y ajuste rápido de stock. La confirmación de borrado y los
 * toasts los orquesta el container.
 */
export function MenuAdminTable({
  items,
  onEditar,
  onEliminar,
  onToggleDisponible,
  onStock,
}: MenuAdminTableProps) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay platos aún.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
        >
          <div className="min-w-[8rem] flex-1">
            <p className="font-medium text-foreground">{item.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {item.categoriaId} · {formatMoney(item.precio)} ·{" "}
              {etiquetaDisponibilidad(item)}
            </p>
          </div>

          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            Stock
            <input
              type="number"
              min={0}
              step="1"
              defaultValue={item.stockDelDia}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n !== item.stockDelDia) {
                  onStock(item, n);
                }
              }}
              className="min-h-[44px] w-20 rounded-md border border-input bg-background px-2 text-foreground"
            />
          </label>

          <button
            type="button"
            onClick={() => onToggleDisponible(item)}
            aria-pressed={item.disponible}
            className="min-h-[44px] rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            {item.disponible ? "Ocultar" : "Mostrar"}
          </button>
          <button
            type="button"
            onClick={() => onEditar(item)}
            className="min-h-[44px] rounded-md border border-input px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onEliminar(item)}
            className="min-h-[44px] rounded-md px-3 text-sm font-medium text-destructive hover:bg-muted"
          >
            Eliminar
          </button>
        </li>
      ))}
    </ul>
  );
}
