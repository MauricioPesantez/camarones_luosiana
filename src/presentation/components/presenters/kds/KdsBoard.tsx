"use client";

import type { OrderDTO } from "@/presentation/http/dto";

import { OrderCard } from "./OrderCard";

export interface KdsBoardProps {
  readonly orders: readonly OrderDTO[];
  readonly onIniciar: (order: OrderDTO) => void;
  readonly onMarcarLista: (order: OrderDTO) => void;
}

/**
 * Tablero del KDS: cola visual persistente de órdenes (R14.2). Presentacional
 * puro; recibe la cola ya filtrada/ordenada y delega las acciones por tarjeta.
 */
export function KdsBoard({ orders, onIniciar, onMarcarLista }: KdsBoardProps) {
  if (orders.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        No hay órdenes en cocina.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onIniciar={onIniciar}
          onMarcarLista={onMarcarLista}
        />
      ))}
    </div>
  );
}
