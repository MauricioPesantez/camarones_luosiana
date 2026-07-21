import { describe, it, expect } from "vitest";
import { OrderItem } from "./OrderItem";
import { Money } from "./Money";
import { DomainError } from "../shared/DomainError";

function crearItem(overrides: Partial<Parameters<typeof OrderItem.crear>[0]> = {}) {
  return OrderItem.crear({
    id: "oi-1",
    menuItemId: "mi-1",
    nombrePlato: "Ceviche de camarón",
    precioUnit: Money.de(8.5),
    cantidad: 2,
    ...overrides,
  });
}

describe("OrderItem", () => {
  describe("creación", () => {
    it("crea un ítem válido con su snapshot de nombre y precio", () => {
      const item = crearItem();
      expect(item.id).toBe("oi-1");
      expect(item.menuItemId).toBe("mi-1");
      expect(item.nombrePlato).toBe("Ceviche de camarón");
      expect(item.precioUnit.toDecimal()).toBe(8.5);
      expect(item.cantidad).toBe(2);
    });

    it("recorta el nombre del plato y rechaza nombres vacíos", () => {
      expect(crearItem({ nombrePlato: "  Encebollado  " }).nombrePlato).toBe(
        "Encebollado",
      );
      expect(() => crearItem({ nombrePlato: "   " })).toThrow(DomainError);
    });

    it("rechaza precio unitario negativo", () => {
      expect(() => crearItem({ precioUnit: Money.de(-1) })).toThrow(DomainError);
    });

    it("rechaza cantidad no entera o menor o igual a cero", () => {
      expect(() => crearItem({ cantidad: 0 })).toThrow(DomainError);
      expect(() => crearItem({ cantidad: -1 })).toThrow(DomainError);
      expect(() => crearItem({ cantidad: 1.5 })).toThrow(DomainError);
    });
  });

  describe("importe de la línea", () => {
    it("calcula precioUnit × cantidad", () => {
      expect(crearItem({ precioUnit: Money.de(8.5), cantidad: 3 }).importe().toDecimal()).toBe(
        25.5,
      );
    });
  });

  describe("cambiarCantidad", () => {
    it("actualiza la cantidad validando entero positivo", () => {
      const item = crearItem({ cantidad: 1 });
      item.cambiarCantidad(4);
      expect(item.cantidad).toBe(4);
      expect(() => item.cambiarCantidad(0)).toThrow(DomainError);
    });
  });
});
