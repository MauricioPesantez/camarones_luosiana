import { describe, expect, it } from "vitest";

import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderStatus } from "@/domain/order/OrderStatus";
import type { OrderDTO } from "@/presentation/http/dto";

import {
  colaCocina,
  mensajeConfirmarLista,
  mensajeOrdenLista,
  puedeIniciar,
  puedeMarcarLista,
  sinAtender,
} from "./kds";

function orden(estado: OrderStatus, numero: number): OrderDTO {
  return {
    id: `o${numero}`,
    numero,
    canal: OrderChannel.SALON,
    estado,
    mesa: numero,
    clienteNombre: null,
    clienteDireccion: null,
    clienteTelefono: null,
    subtotal: 0,
    envases: 0,
    envio: 0,
    total: 0,
    items: [],
  };
}

describe("colaCocina", () => {
  it("excluye estados no relevantes para cocina", () => {
    const cola = colaCocina([
      orden(OrderStatus.ABIERTA, 1),
      orden(OrderStatus.ENVIADA_A_COCINA, 2),
      orden(OrderStatus.EN_PREPARACION, 3),
      orden(OrderStatus.LISTA, 4),
      orden(OrderStatus.ENTREGADA, 5),
      orden(OrderStatus.CANCELADA, 6),
    ]);
    expect(cola.map((o) => o.numero).sort()).toEqual([2, 3, 4]);
  });

  it("prioriza órdenes sin atender y luego por número ascendente", () => {
    const cola = colaCocina([
      orden(OrderStatus.EN_PREPARACION, 10),
      orden(OrderStatus.ENVIADA_A_COCINA, 20),
      orden(OrderStatus.ENVIADA_A_COCINA, 5),
      orden(OrderStatus.LISTA, 8),
    ]);
    // Sin atender (5, 20) primero por número; luego el resto por número.
    expect(cola.map((o) => o.numero)).toEqual([5, 20, 8, 10]);
  });
});

describe("banderas de estado", () => {
  it("sinAtender solo para ENVIADA_A_COCINA", () => {
    expect(sinAtender(orden(OrderStatus.ENVIADA_A_COCINA, 1))).toBe(true);
    expect(sinAtender(orden(OrderStatus.EN_PREPARACION, 1))).toBe(false);
  });

  it("puedeIniciar solo desde ENVIADA_A_COCINA (R6.2)", () => {
    expect(puedeIniciar(orden(OrderStatus.ENVIADA_A_COCINA, 1))).toBe(true);
    expect(puedeIniciar(orden(OrderStatus.EN_PREPARACION, 1))).toBe(false);
  });

  it("puedeMarcarLista solo desde EN_PREPARACION (R6.3)", () => {
    expect(puedeMarcarLista(orden(OrderStatus.EN_PREPARACION, 1))).toBe(true);
    expect(puedeMarcarLista(orden(OrderStatus.ENVIADA_A_COCINA, 1))).toBe(false);
    expect(puedeMarcarLista(orden(OrderStatus.LISTA, 1))).toBe(false);
  });
});

describe("mensajes", () => {
  it("confirmación de marcar lista usa el número (R15.2)", () => {
    expect(mensajeConfirmarLista(42)).toBe(
      "¿Deseas marcar la orden #42 como terminada?",
    );
  });

  it("toast de orden lista usa el número (R15.3)", () => {
    expect(mensajeOrdenLista(42)).toBe("Orden #42 lista");
  });
});
