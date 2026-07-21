import { describe, it, expect } from "vitest";
import { MenuItem } from "./MenuItem";
import { Money } from "../order/Money";
import { DomainError } from "../shared/DomainError";

function crearItem(overrides: Partial<Parameters<typeof MenuItem.crear>[0]> = {}) {
  return MenuItem.crear({
    id: "item-1",
    nombre: "Ceviche de camarón",
    categoriaId: "cat-1",
    precio: Money.de(8.5),
    stockDelDia: 10,
    disponible: true,
    ...overrides,
  });
}

describe("MenuItem", () => {
  describe("creación", () => {
    it("crea un plato válido con sus propiedades", () => {
      const item = crearItem();
      expect(item.nombre).toBe("Ceviche de camarón");
      expect(item.precio.toDecimal()).toBe(8.5);
      expect(item.stockDelDia).toBe(10);
      expect(item.disponible).toBe(true);
      expect(item.fotoUrl).toBeNull();
    });

    it("recorta el nombre y rechaza nombres vacíos", () => {
      expect(crearItem({ nombre: "  Encebollado  " }).nombre).toBe("Encebollado");
      expect(() => crearItem({ nombre: "   " })).toThrow(DomainError);
    });

    it("rechaza precio negativo", () => {
      expect(() => crearItem({ precio: Money.de(-1) })).toThrow(DomainError);
    });

    it("rechaza stock inicial negativo o no entero", () => {
      expect(() => crearItem({ stockDelDia: -1 })).toThrow(DomainError);
      expect(() => crearItem({ stockDelDia: 2.5 })).toThrow(DomainError);
    });
  });

  describe("conservación de stock (R3.3, R5.2)", () => {
    it("decrementar resta exactamente la cantidad pedida", () => {
      const item = crearItem({ stockDelDia: 10 });
      item.decrementar(3);
      expect(item.stockDelDia).toBe(7);
    });

    it("incrementar restaura exactamente la cantidad devuelta", () => {
      const item = crearItem({ stockDelDia: 10 });
      item.decrementar(4);
      item.incrementar(4);
      expect(item.stockDelDia).toBe(10);
    });

    it("una secuencia de decrementos/incrementos conserva el stock", () => {
      const item = crearItem({ stockDelDia: 10 });
      item.decrementar(2);
      item.decrementar(3);
      item.incrementar(1);
      // 10 - 2 - 3 + 1 = 6
      expect(item.stockDelDia).toBe(6);
    });

    it("nunca permite stock negativo: rechaza decrementar más de lo disponible", () => {
      const item = crearItem({ stockDelDia: 2 });
      expect(() => item.decrementar(3)).toThrow(DomainError);
      // el stock no se modifica al fallar
      expect(item.stockDelDia).toBe(2);
    });

    it("rechaza cantidades no positivas o no enteras", () => {
      const item = crearItem({ stockDelDia: 5 });
      expect(() => item.decrementar(0)).toThrow(DomainError);
      expect(() => item.decrementar(-1)).toThrow(DomainError);
      expect(() => item.decrementar(1.5)).toThrow(DomainError);
      expect(() => item.incrementar(0)).toThrow(DomainError);
    });
  });

  describe("auto-86 (R3.4)", () => {
    it("al llegar a 0 marca disponible=false", () => {
      const item = crearItem({ stockDelDia: 3, disponible: true });
      item.decrementar(3);
      expect(item.stockDelDia).toBe(0);
      expect(item.disponible).toBe(false);
    });

    it("no marca no-disponible mientras quede stock", () => {
      const item = crearItem({ stockDelDia: 3, disponible: true });
      item.decrementar(2);
      expect(item.stockDelDia).toBe(1);
      expect(item.disponible).toBe(true);
    });

    it("incrementar no reactiva la disponibilidad automáticamente", () => {
      const item = crearItem({ stockDelDia: 1, disponible: true });
      item.decrementar(1); // auto-86 → disponible=false
      expect(item.disponible).toBe(false);
      item.incrementar(5);
      expect(item.stockDelDia).toBe(5);
      // sigue no disponible hasta decisión explícita del admin
      expect(item.disponible).toBe(false);
    });

    it("ajustarStock a 0 también aplica auto-86", () => {
      const item = crearItem({ stockDelDia: 10, disponible: true });
      item.ajustarStock(0);
      expect(item.stockDelDia).toBe(0);
      expect(item.disponible).toBe(false);
    });
  });

  describe("ajustes manuales del administrador (R3.6)", () => {
    it("ajustarStock fija el valor y valida que sea entero no negativo", () => {
      const item = crearItem({ stockDelDia: 5 });
      item.ajustarStock(20);
      expect(item.stockDelDia).toBe(20);
      expect(() => item.ajustarStock(-1)).toThrow(DomainError);
      expect(() => item.ajustarStock(1.5)).toThrow(DomainError);
    });

    it("establecerDisponibilidad fuerza el flag", () => {
      const item = crearItem({ stockDelDia: 0, disponible: false });
      item.establecerDisponibilidad(true);
      expect(item.disponible).toBe(true);
      item.establecerDisponibilidad(false);
      expect(item.disponible).toBe(false);
    });

    it("cambiarPrecio rechaza valores negativos", () => {
      const item = crearItem();
      item.cambiarPrecio(Money.de(12));
      expect(item.precio.toDecimal()).toBe(12);
      expect(() => item.cambiarPrecio(Money.de(-0.01))).toThrow(DomainError);
    });
  });
});
