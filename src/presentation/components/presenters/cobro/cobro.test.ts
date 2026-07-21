import { describe, expect, it } from "vitest";

import { MetodoPago } from "@/domain/order/MetodoPago";
import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderStatus } from "@/domain/order/OrderStatus";
import type { OrderDTO } from "@/presentation/http/dto";

import {
  esCobrable,
  formatMoney,
  mensajeCobroRegistrado,
  mensajeConfirmarCobro,
  ordenesCobrables,
  puedeRegistrarCobro,
} from "./cobro";

function orden(estado: OrderStatus, numero: number, total = 0): OrderDTO {
  return {
    id: `o${numero}`,
    numero,
    canal: OrderChannel.SALON,
    estado,
    mesa: numero,
    clienteNombre: null,
    clienteDireccion: null,
    clienteTelefono: null,
    subtotal: total,
    envases: 0,
    envio: 0,
    total,
    items: [],
  };
}

describe("cobrables", () => {
  it("esCobrable solo en ENTREGADA (R9.2)", () => {
    expect(esCobrable(orden(OrderStatus.ENTREGADA, 1))).toBe(true);
    expect(esCobrable(orden(OrderStatus.LISTA, 1))).toBe(false);
    expect(esCobrable(orden(OrderStatus.COBRADA, 1))).toBe(false);
  });

  it("ordenesCobrables filtra y ordena por número", () => {
    const cobrables = ordenesCobrables([
      orden(OrderStatus.ENTREGADA, 8),
      orden(OrderStatus.LISTA, 3),
      orden(OrderStatus.ENTREGADA, 2),
    ]);
    expect(cobrables.map((o) => o.numero)).toEqual([2, 8]);
  });
});

describe("formato y mensajes", () => {
  it("formatMoney con dos decimales", () => {
    expect(formatMoney(12.5)).toBe("$12.50");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("mensaje de confirmación incluye monto y método (R9.4)", () => {
    expect(mensajeConfirmarCobro(12.5, MetodoPago.EFECTIVO)).toBe(
      "¿Registrar el cobro de $12.50 en Efectivo?",
    );
    expect(mensajeConfirmarCobro(30, MetodoPago.TRANSFERENCIA)).toBe(
      "¿Registrar el cobro de $30.00 en Transferencia?",
    );
  });

  it("toast de cobro registrado usa el número (R9.4)", () => {
    expect(mensajeCobroRegistrado(42)).toBe("Cobro registrado · orden #42");
  });
});

describe("puedeRegistrarCobro", () => {
  const entregada = orden(OrderStatus.ENTREGADA, 1, 20);

  it("efectivo no requiere comprobante", () => {
    expect(puedeRegistrarCobro(entregada, MetodoPago.EFECTIVO, false)).toBe(true);
  });

  it("transferencia requiere comprobante (R9.3)", () => {
    expect(puedeRegistrarCobro(entregada, MetodoPago.TRANSFERENCIA, false)).toBe(
      false,
    );
    expect(puedeRegistrarCobro(entregada, MetodoPago.TRANSFERENCIA, true)).toBe(
      true,
    );
  });

  it("sin orden o no cobrable es falso", () => {
    expect(puedeRegistrarCobro(null, MetodoPago.EFECTIVO, false)).toBe(false);
    expect(
      puedeRegistrarCobro(orden(OrderStatus.LISTA, 1), MetodoPago.EFECTIVO, false),
    ).toBe(false);
  });
});
