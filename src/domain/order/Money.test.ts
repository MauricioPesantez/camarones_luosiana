import { describe, it, expect } from "vitest";
import { Money } from "./Money";

describe("Money", () => {
  describe("creación", () => {
    it("crea desde decimal y vuelve a decimal sin pérdida", () => {
      expect(Money.de(0.5).toDecimal()).toBe(0.5);
      expect(Money.de(12.34).toDecimal()).toBe(12.34);
    });

    it("cero() es exactamente cero", () => {
      const c = Money.cero();
      expect(c.esCero()).toBe(true);
      expect(c.toDecimal()).toBe(0);
      expect(c.centavos).toBe(0);
    });

    it("deCentavos crea a partir de centavos enteros", () => {
      expect(Money.deCentavos(50).toDecimal()).toBe(0.5);
      expect(Money.deCentavos(-125).toDecimal()).toBe(-1.25);
    });

    it("rechaza valores no finitos en de()", () => {
      expect(() => Money.de(Number.NaN)).toThrow(RangeError);
      expect(() => Money.de(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    });

    it("rechaza centavos no enteros en deCentavos()", () => {
      expect(() => Money.deCentavos(1.5)).toThrow(RangeError);
    });
  });

  describe("redondeo", () => {
    it("redondea al centavo más cercano", () => {
      expect(Money.de(0.005).centavos).toBe(1);
      expect(Money.de(0.004).centavos).toBe(0);
      expect(Money.de(1.005).centavos).toBe(101);
    });

    it("tolera imprecisión de coma flotante", () => {
      // 0.1 + 0.2 === 0.30000000000000004 en flotante nativo
      const suma = Money.de(0.1).suma(Money.de(0.2));
      expect(suma.toDecimal()).toBe(0.3);
      expect(suma.centavos).toBe(30);
    });

    it("redondea simétricamente para montos negativos", () => {
      expect(Money.de(-0.005).centavos).toBe(-1);
      expect(Money.de(-0.004).centavos).toBe(0);
    });
  });

  describe("aritmética", () => {
    it("suma montos", () => {
      expect(Money.de(1.25).suma(Money.de(2.5)).toDecimal()).toBe(3.75);
    });

    it("resta montos y permite resultado negativo", () => {
      expect(Money.de(2).resta(Money.de(0.5)).toDecimal()).toBe(1.5);
      const neg = Money.de(1).resta(Money.de(3));
      expect(neg.toDecimal()).toBe(-2);
      expect(neg.esNegativo()).toBe(true);
    });

    it("multiplica por cantidad entera", () => {
      expect(Money.de(2.5).multiplica(3).toDecimal()).toBe(7.5);
      expect(Money.de(0.5).multiplica(0).esCero()).toBe(true);
    });

    it("rechaza multiplicar por cantidad no entera", () => {
      expect(() => Money.de(1).multiplica(2.5)).toThrow(RangeError);
    });

    it("la suma es asociativa y conmutativa en centavos", () => {
      const a = Money.de(0.1);
      const b = Money.de(0.2);
      const c = Money.de(0.3);
      expect(a.suma(b).suma(c).centavos).toBe(c.suma(b).suma(a).centavos);
    });
  });

  describe("signo y predicados", () => {
    it("negativo() invierte el signo", () => {
      expect(Money.de(1.5).negativo().toDecimal()).toBe(-1.5);
      expect(Money.de(-1.5).negativo().toDecimal()).toBe(1.5);
    });

    it("negativo() de cero sigue siendo cero (sin -0)", () => {
      const z = Money.cero().negativo();
      expect(z.esCero()).toBe(true);
      expect(Object.is(z.toDecimal(), -0)).toBe(false);
    });

    it("esCero y esNegativo reflejan el monto", () => {
      expect(Money.cero().esCero()).toBe(true);
      expect(Money.de(0.01).esCero()).toBe(false);
      expect(Money.de(-0.01).esNegativo()).toBe(true);
      expect(Money.de(0.01).esNegativo()).toBe(false);
    });
  });

  describe("igualdad e inmutabilidad", () => {
    it("equals compara por valor", () => {
      expect(Money.de(1.5).equals(Money.deCentavos(150))).toBe(true);
      expect(Money.de(1.5).equals(Money.de(1.51))).toBe(false);
    });

    it("las operaciones no mutan la instancia original", () => {
      const original = Money.de(1);
      original.suma(Money.de(5));
      original.multiplica(10);
      original.negativo();
      expect(original.toDecimal()).toBe(1);
    });
  });

  describe("formato", () => {
    it("toString muestra dos decimales", () => {
      expect(Money.de(0.5).toString()).toBe("0.50");
      expect(Money.de(-1.25).toString()).toBe("-1.25");
      expect(Money.cero().toString()).toBe("0.00");
    });
  });
});
