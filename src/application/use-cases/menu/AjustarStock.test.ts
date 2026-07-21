import { beforeEach, describe, expect, it } from "vitest";

import { MenuItem } from "@/domain/menu/MenuItem";
import { Money } from "@/domain/order/Money";
import { isErr, isOk } from "@/domain/shared/Result";

import { FakeMenuRepository } from "../orders/testFakes";
import { AjustarStock } from "./AjustarStock";

/** Crea un MenuItem básico para las pruebas. */
function crearItem(
  id: string,
  stock: number,
  disponible: boolean,
): MenuItem {
  return MenuItem.crear({
    id,
    nombre: `Plato ${id}`,
    categoriaId: "cat-1",
    precio: Money.de(10),
    stockDelDia: stock,
    disponible,
  });
}

describe("AjustarStock (R3.6, R3.7)", () => {
  let menu: FakeMenuRepository;
  let ajustar: AjustarStock;

  beforeEach(() => {
    menu = new FakeMenuRepository();
    ajustar = new AjustarStock(menu);
  });

  describe("establecerStock (R3.6)", () => {
    it("fija manualmente el stock del Plato y lo persiste", async () => {
      menu.agregar(crearItem("p1", 5, true));

      const resultado = await ajustar.establecerStock("p1", 30);

      expect(isOk(resultado)).toBe(true);
      if (isOk(resultado)) {
        expect(resultado.value.stockDelDia).toBe(30);
      }
      const guardado = await menu.obtener("p1");
      expect(guardado?.stockDelDia).toBe(30);
    });

    it("aplica auto-86 cuando el stock se fija en 0 (R3.4)", async () => {
      menu.agregar(crearItem("p1", 5, true));

      const resultado = await ajustar.establecerStock("p1", 0);

      expect(isOk(resultado)).toBe(true);
      if (isOk(resultado)) {
        expect(resultado.value.stockDelDia).toBe(0);
        expect(resultado.value.disponible).toBe(false);
      }
    });

    it("rechaza un stock negativo (no permite stock negativo)", async () => {
      menu.agregar(crearItem("p1", 5, true));

      const resultado = await ajustar.establecerStock("p1", -1);

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_STOCK_NEGATIVO");
      }
      // El stock persistido no cambió.
      const guardado = await menu.obtener("p1");
      expect(guardado?.stockDelDia).toBe(5);
    });

    it("rechaza un stock no entero", async () => {
      menu.agregar(crearItem("p1", 5, true));

      const resultado = await ajustar.establecerStock("p1", 2.5);

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_STOCK_NO_ENTERO");
      }
    });

    it("retorna error si el Plato no existe", async () => {
      const resultado = await ajustar.establecerStock("inexistente", 10);

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_NO_ENCONTRADO");
      }
    });
  });

  describe("forzarDisponibilidad (R3.6)", () => {
    it("fuerza la disponibilidad a false", async () => {
      menu.agregar(crearItem("p1", 5, true));

      const resultado = await ajustar.forzarDisponibilidad("p1", false);

      expect(isOk(resultado)).toBe(true);
      if (isOk(resultado)) {
        expect(resultado.value.disponible).toBe(false);
        // El stock no se ve afectado por forzar la disponibilidad.
        expect(resultado.value.stockDelDia).toBe(5);
      }
    });

    it("reactiva un Plato deshabilitado por auto-86 (disponible on)", async () => {
      // Plato con stock pero deshabilitado manualmente.
      menu.agregar(crearItem("p1", 4, false));

      const resultado = await ajustar.forzarDisponibilidad("p1", true);

      expect(isOk(resultado)).toBe(true);
      if (isOk(resultado)) {
        expect(resultado.value.disponible).toBe(true);
      }
      const guardado = await menu.obtener("p1");
      expect(guardado?.disponible).toBe(true);
    });

    it("retorna error si el Plato no existe", async () => {
      const resultado = await ajustar.forzarDisponibilidad("inexistente", true);

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_NO_ENCONTRADO");
      }
    });
  });

  describe("resetDiario (R3.7)", () => {
    beforeEach(() => {
      menu.agregar(crearItem("p1", 0, false));
      menu.agregar(crearItem("p2", 2, false));
    });

    it("reinicia el stock de varios Platos y deriva la disponibilidad del stock", async () => {
      const resultado = await ajustar.resetDiario([
        { menuItemId: "p1", stock: 10 },
        { menuItemId: "p2", stock: 0 },
      ]);

      expect(isOk(resultado)).toBe(true);
      if (isOk(resultado)) {
        const [p1, p2] = resultado.value;
        // Stock > 0 vuelve disponible al iniciar el día.
        expect(p1.stockDelDia).toBe(10);
        expect(p1.disponible).toBe(true);
        // Stock 0 permanece deshabilitado por auto-86.
        expect(p2.stockDelDia).toBe(0);
        expect(p2.disponible).toBe(false);
      }
    });

    it("respeta la disponibilidad explícita cuando se provee", async () => {
      const resultado = await ajustar.resetDiario([
        { menuItemId: "p1", stock: 10, disponible: false },
      ]);

      expect(isOk(resultado)).toBe(true);
      if (isOk(resultado)) {
        const [p1] = resultado.value;
        expect(p1.stockDelDia).toBe(10);
        expect(p1.disponible).toBe(false);
      }
    });

    it("no aplica cambios parciales si algún Plato no existe", async () => {
      const resultado = await ajustar.resetDiario([
        { menuItemId: "p1", stock: 99 },
        { menuItemId: "inexistente", stock: 5 },
      ]);

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_NO_ENCONTRADO");
      }
      // p1 no debió modificarse: la validación ocurre antes de persistir.
      const p1 = await menu.obtener("p1");
      expect(p1?.stockDelDia).toBe(0);
    });

    it("rechaza la carga si alguna entrada tiene stock negativo", async () => {
      const resultado = await ajustar.resetDiario([
        { menuItemId: "p1", stock: -3 },
      ]);

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_STOCK_NEGATIVO");
      }
    });
  });
});
