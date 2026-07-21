"use client";

import { OrderStatus } from "@/domain/order/OrderStatus";
import type { OrderDTO } from "@/presentation/http/dto";

import { puedeIniciar, puedeMarcarLista, sinAtender } from "./kds";

export interface OrderCardProps {
  readonly order: OrderDTO;
  readonly onIniciar: (order: OrderDTO) => void;
  readonly onMarcarLista: (order: OrderDTO) => void;
}

const REFERENCIA_CANAL = (o: OrderDTO): string => {
  if (o.canal === "SALON") return o.mesa ? `Mesa ${o.mesa}` : "Salón";
  if (o.canal === "DELIVERY") return "Delivery";
  return "Retirar";
};

/**
 * Tarjeta de una orden en el KDS. Presentacional puro: pinta ítems y expone la
 * acción según el estado (iniciar / marcar lista). Las órdenes sin atender
 * llevan un badge destacado (R14.3).
 */
export function OrderCard({ order, onIniciar, onMarcarLista }: OrderCardProps) {
  const destacada = sinAtender(order);

  return (
    <article
      className={
        destacada
          ? "flex flex-col gap-3 rounded-lg border-2 border-primary bg-primary/5 p-4"
          : "flex flex-col gap-3 rounded-lg border border-border p-4"
      }
    >
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">#{order.numero}</h2>
        {destacada ? (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            Nueva
          </span>
        ) : order.estado === OrderStatus.LISTA ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Lista
          </span>
        ) : null}
      </header>

      <p className="text-sm text-muted-foreground">{REFERENCIA_CANAL(order)}</p>

      <ul className="flex flex-col gap-1">
        {order.items.map((item) => (
          <li key={item.id} className="flex gap-2 text-foreground">
            <span className="font-semibold">{item.cantidad}×</span>
            <span>{item.nombrePlato}</span>
          </li>
        ))}
      </ul>

      {puedeIniciar(order) && (
        <button
          type="button"
          onClick={() => onIniciar(order)}
          className="min-h-[44px] rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Iniciar preparación
        </button>
      )}
      {puedeMarcarLista(order) && (
        <button
          type="button"
          onClick={() => onMarcarLista(order)}
          className="min-h-[44px] rounded-md bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Marcar lista
        </button>
      )}
    </article>
  );
}
