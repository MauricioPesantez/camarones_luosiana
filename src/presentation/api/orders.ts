import type { MenuItemDTO, OrderDTO } from "@/presentation/http/dto";
import type { MetodoPago } from "@/domain/order/MetodoPago";
import type { OrderChannel } from "@/domain/order/OrderChannel";

import { apiFetch } from "./client";

/** Línea del carrito enviada al crear la orden. */
export interface CrearOrdenItemPayload {
  menuItemId: string;
  cantidad: number;
}

export interface CrearOrdenPayload {
  canal: OrderChannel;
  mesa?: number | null;
  clienteNombre?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
  envio?: number;
  /** Ítems del carrito. Se crean junto con la orden en una sola operación. */
  items?: CrearOrdenItemPayload[];
}

/** `GET /api/menu` — platos con disponibilidad y stock. */
export async function listarMenu(): Promise<MenuItemDTO[]> {
  const { items } = await apiFetch<{ items: MenuItemDTO[] }>("/api/menu");
  return items;
}

/** `GET /api/orders/active` — órdenes activas para el KDS (R14.1). */
export async function ordenesActivas(signal?: AbortSignal): Promise<OrderDTO[]> {
  const { orders } = await apiFetch<{ orders: OrderDTO[] }>(
    "/api/orders/active",
    { signal },
  );
  return orders;
}

/** `POST /api/orders/[id]/iniciar` — inicia preparación (R6.2). */
export function iniciarPreparacion(orderId: string): Promise<OrderDTO> {
  return apiFetch<OrderDTO>(`/api/orders/${orderId}/iniciar`, {
    method: "POST",
  });
}

/** `POST /api/orders/[id]/lista` — marca la orden lista (R6.3, R15.1). */
export function marcarLista(orderId: string): Promise<OrderDTO> {
  return apiFetch<OrderDTO>(`/api/orders/${orderId}/lista`, {
    method: "POST",
  });
}

/** `POST /api/orders` — crea una orden `ABIERTA` por canal, con sus ítems (R4, R5.1). */
export function crearOrden(payload: CrearOrdenPayload): Promise<OrderDTO> {
  return apiFetch<OrderDTO>("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** `POST /api/orders/[id]/items` — agrega un ítem (R5.1). */
export function agregarItem(
  orderId: string,
  menuItemId: string,
  cantidad: number,
): Promise<OrderDTO> {
  return apiFetch<OrderDTO>(`/api/orders/${orderId}/items`, {
    method: "POST",
    body: JSON.stringify({ menuItemId, cantidad }),
  });
}

/** `DELETE /api/orders/[id]/items/[itemId]` — quita un ítem (R5.1, R5.2). */
export function quitarItem(
  orderId: string,
  itemId: string,
): Promise<OrderDTO> {
  return apiFetch<OrderDTO>(`/api/orders/${orderId}/items/${itemId}`, {
    method: "DELETE",
  });
}

/** `POST /api/orders/[id]/enviar-cocina` — transición a cocina (R6.1). */
export function enviarACocina(orderId: string): Promise<OrderDTO> {
  return apiFetch<OrderDTO>(`/api/orders/${orderId}/enviar-cocina`, {
    method: "POST",
  });
}

/**
 * `POST /api/orders/[id]/cobrar` — registra el cobro (R9). `EFECTIVO` va como
 * JSON; `TRANSFERENCIA` como `multipart/form-data` con el comprobante (R9.3).
 */
export function cobrarOrden(
  orderId: string,
  metodoPago: MetodoPago,
  comprobante?: File,
): Promise<OrderDTO> {
  if (metodoPago === "TRANSFERENCIA") {
    const form = new FormData();
    form.append("metodoPago", metodoPago);
    if (comprobante) form.append("comprobante", comprobante);
    return apiFetch<OrderDTO>(`/api/orders/${orderId}/cobrar`, {
      method: "POST",
      body: form,
    });
  }
  return apiFetch<OrderDTO>(`/api/orders/${orderId}/cobrar`, {
    method: "POST",
    body: JSON.stringify({ metodoPago }),
  });
}

/** `POST /api/orders/[id]/cancelar` — cancela la orden (R6.8, R7). */
export function cancelarOrden(
  orderId: string,
  motivo?: string,
): Promise<OrderDTO> {
  return apiFetch<OrderDTO>(`/api/orders/${orderId}/cancelar`, {
    method: "POST",
    body: JSON.stringify(motivo ? { motivo } : {}),
  });
}
