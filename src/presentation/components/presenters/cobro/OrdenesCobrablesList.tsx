"use client";

import type { OrderDTO } from "@/presentation/http/dto";

import { formatMoney } from "./cobro";

export interface OrdenesCobrablesListProps {
  readonly orders: readonly OrderDTO[];
  readonly selectedId: string | null;
  readonly onSelect: (order: OrderDTO) => void;
}

/**
 * Lista de órdenes entregadas pendientes de cobro (R9.2). Presentacional puro;
 * resalta la seleccionada y emite `onSelect`.
 */
export function OrdenesCobrablesList({
  orders,
  selectedId,
  onSelect,
}: OrdenesCobrablesListProps) {
  if (orders.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay órdenes por cobrar.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {orders.map((order) => (
        <li key={order.id}>
          <button
            type="button"
            aria-pressed={selectedId === order.id}
            onClick={() => onSelect(order)}
            className={
              selectedId === order.id
                ? "flex min-h-[44px] w-full items-center justify-between rounded-md border-2 border-primary bg-primary/5 px-4"
                : "flex min-h-[44px] w-full items-center justify-between rounded-md border border-input px-4 hover:bg-muted"
            }
          >
            <span className="font-medium text-foreground">#{order.numero}</span>
            <span className="text-sm text-muted-foreground">
              {formatMoney(order.total)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
