import { describe, expect, it } from "vitest";

import { OrderChannel } from "@/domain/order/OrderChannel";
import { OrderStatus } from "@/domain/order/OrderStatus";
import type { MenuItemDTO, OrderDTO } from "@/presentation/http/dto";

import {
  MENSAJE_CANCELAR,
  mensajeAgregado,
  mensajeConfirmarEnvio,
  mensajeQuitado,
  permiteEditarItems,
  puedeAgregarPlato,
  puedeEnviarACocina,
  totalUnidades,
  validarDatosDeCanal,
} from "./orderTaking";

function orden(overrides: Partial<OrderDTO> = {}): OrderDTO {
  return {
    id: "o1",
    numero: 1,
    canal: OrderChannel.SALON,
    estado: OrderStatus.ABIERTA,
    mesa: 5,
    clienteNombre: null,
    clienteDireccion: null,
    clienteTelefono: null,
    subtotal: 0,
    envases: 0,
    envio: 0,
    total: 0,
    items: [],
    ...overrides,
  };
}

function plato(overrides: Partial<MenuItemDTO> = {}): MenuItemDTO {
  return {
    id: "m1",
    nombre: "Ceviche",
    categoriaId: "c1",
    precio: 8,
    fotoUrl: null,
    stockDelDia: 10,
    disponible: true,
    ...overrides,
  };
}

describe("mensajes de toast", () => {
  it("agregar/quitar usan el nombre del plato", () => {
    expect(mensajeAgregado("Ceviche")).toBe("Ceviche agregado");
    expect(mensajeQuitado("Ceviche")).toBe("Ceviche quitado");
  });

  it("confirmar envío pluraliza según cantidad", () => {
    expect(mensajeConfirmarEnvio(1)).toBe("Se enviarán 1 ítem a cocina. ¿Continuar?");
    expect(mensajeConfirmarEnvio(3)).toBe("Se enviarán 3 ítems a cocina. ¿Continuar?");
  });

  it("mensaje de cancelación es el texto exacto de la spec (R17.2)", () => {
    expect(MENSAJE_CANCELAR).toBe(
      "Se cancelará y quedará en el historial de auditoría. ¿Continuar?",
    );
  });
});

describe("validarDatosDeCanal", () => {
  it("SALON exige mesa válida (R4.4)", () => {
    expect(validarDatosDeCanal({ canal: OrderChannel.SALON, mesa: null })).toBe(
      "Ingresa el número de mesa",
    );
    expect(validarDatosDeCanal({ canal: OrderChannel.SALON, mesa: 0 })).not.toBeNull();
    expect(validarDatosDeCanal({ canal: OrderChannel.SALON, mesa: 5 })).toBeNull();
  });

  it("DELIVERY exige dirección (R4.5)", () => {
    expect(
      validarDatosDeCanal({ canal: OrderChannel.DELIVERY, clienteDireccion: "  " }),
    ).toBe("Ingresa la dirección del cliente");
    expect(
      validarDatosDeCanal({ canal: OrderChannel.DELIVERY, clienteDireccion: "Av 1" }),
    ).toBeNull();
  });

  it("RETIRAR no exige datos extra (R4.3)", () => {
    expect(validarDatosDeCanal({ canal: OrderChannel.RETIRAR })).toBeNull();
  });
});

describe("banderas derivadas", () => {
  it("puedeAgregarPlato requiere disponible y stock", () => {
    expect(puedeAgregarPlato(plato())).toBe(true);
    expect(puedeAgregarPlato(plato({ disponible: false }))).toBe(false);
    expect(puedeAgregarPlato(plato({ stockDelDia: 0 }))).toBe(false);
  });

  it("permiteEditarItems en ABIERTA/EN_PREPARACION/ENTREGADA (R5.1, R5.5)", () => {
    expect(permiteEditarItems(OrderStatus.ABIERTA)).toBe(true);
    expect(permiteEditarItems(OrderStatus.EN_PREPARACION)).toBe(true);
    expect(permiteEditarItems(OrderStatus.ENTREGADA)).toBe(true);
    expect(permiteEditarItems(OrderStatus.COBRADA)).toBe(false);
    expect(permiteEditarItems(OrderStatus.CANCELADA)).toBe(false);
  });

  it("puedeEnviarACocina solo desde ABIERTA con ítems (R6.1)", () => {
    const items = [
      { id: "i1", menuItemId: "m1", nombrePlato: "Ceviche", precioUnit: 8, cantidad: 2 },
    ];
    expect(puedeEnviarACocina(orden({ items }))).toBe(true);
    expect(puedeEnviarACocina(orden({ items: [] }))).toBe(false);
    expect(
      puedeEnviarACocina(orden({ estado: OrderStatus.EN_PREPARACION, items })),
    ).toBe(false);
  });

  it("totalUnidades suma cantidades", () => {
    const items = [
      { id: "i1", menuItemId: "m1", nombrePlato: "A", precioUnit: 8, cantidad: 2 },
      { id: "i2", menuItemId: "m2", nombrePlato: "B", precioUnit: 5, cantidad: 3 },
    ];
    expect(totalUnidades(orden({ items }))).toBe(5);
  });
});
