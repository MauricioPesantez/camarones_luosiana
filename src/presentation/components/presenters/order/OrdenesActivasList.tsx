"use client";

import { OrderChannel } from "@/domain/order/OrderChannel";
import type { OrderDTO } from "@/presentation/http/dto";

const money = (n: number) => `$${n.toFixed(2)}`;

const ETIQUETA_CANAL: Record<OrderChannel, string> = {
  SALON: "Salón",
  DELIVERY: "Delivery",
  RETIRAR: "Retirar",
};

export interface OrdenesActivasListProps {
  readonly orders: readonly OrderDTO[];
  readonly onReabrir: (order: OrderDTO) => void;
}

/** Descripción corta del canal (mesa o cliente) para identificar la orden. */
function descripcion(order: OrderDTO): string {
  if (order.canal === OrderChannel.SALON) {
    return order.mesa != null ? `Mesa ${order.mesa}` : "Salón";
  }
  if (order.canal === OrderChannel.DELIVERY) {
    return order.clienteNombre || order.clienteDireccion || "Delivery";
  }
  return ETIQUETA_CANAL[order.canal as OrderChannel] ?? order.canal;
}

/**
 * Lista de órdenes activas para reabrir y editar (running tab). Presentacional
 * puro; muestra número, canal, estado y total, y emite `onReabrir`.
 */
export function OrdenesActivasList({ orders, onReabrir }: OrdenesActivasListProps) {
  if (orders.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay órdenes activas.
      </p>
    );
  }

  const ordenadas = [...orders].sort((a, b) => a.numero - b.numero);

  return (
    <ul className="flex flex-col gap-2">
      {ordenadas.map((order) => (
        <li key={order.id}>
          <button
            type="button"
            onClick={() => onReabrir(order)}
            className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md border border-input px-4 py-2 text-left hover:bg-muted"
          >
            <span className="flex flex-col">
              <span className="font-medium text-foreground">
                #{order.numero || "—"} · {descripcion(order)}
              </span>
              <span className="text-xs text-muted-foreground">
                {ETIQUETA_CANAL[order.canal as OrderChannel] ?? order.canal}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {order.estado}
              </span>
              <span className="text-sm text-muted-foreground">
                {money(order.total)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
