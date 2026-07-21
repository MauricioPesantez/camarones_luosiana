import { beforeEach, describe, expect, it } from "vitest";

import { MenuItem } from "@/domain/menu/MenuItem";
import { Money } from "@/domain/order/Money";
import { isErr, isOk } from "@/domain/shared/Result";

import { FakeMenuRepository } from "../orders/testFakes";
import { GestionarMenu } from "./GestionarMenu";

/** Crea un GestionarMenu con un generador de ids determinista. */
function crear() {
  const menu = new FakeMenuRepository();
  let contador = 0;
  const generarId = () => `plato-${(contador += 1)}`;
  const gestionar = new GestionarMenu(menu, generarId);
  return { menu, gestionar };
}

describe("GestionarMenu (R3.1)", () => {
  let menu: FakeMenuRepository;
  let gestionar: GestionarMenu;

  beforeEach(() => {
    ({ menu, gestionar } = crear());
  });

  describe("crear", () => {
    it("crea y persiste un Plato con todos sus campos", async () => {
      const resultado = await gestionar.crear({
        nombre: "Camarones al ajillo",
        categoriaId: "cat-1",
        precio: Money.de(12.5),
        fotoUrl: "https://cdn/foto.jpg",
        stockDelDia: 20,
        disponible: true,
      });

      expect(isOk(resultado)).toBe(true);
      if (isOk(resultado)) {
        const item = resultado.value;
        expect(item.id).toBe("plato-1");
        expect(item.nombre).toBe("Camarones al ajillo");
        expect(item.categoriaId).toBe("cat-1");
        expect(item.precio.toDecimal()).toBe(12.5);
        expect(item.fotoUrl).toBe("https://cdn/foto.jpg");
        expect(item.stockDelDia).toBe(20);
        expect(item.disponible).toBe(true);

        // Persistido en el repositorio.
        const guardado = await menu.obtener("plato-1");
        expect(guardado).not.toBeNull();
        expect(guardado?.nombre).toBe("Camarones al ajillo");
      }
    });

    it("normaliza fotoUrl ausente a null", async () => {
      const resultado = await gestionar.crear({
        nombre: "Bebida",
        categoriaId: "cat-2",
        precio: Money.de(2),
        stockDelDia: 5,
        disponible: true,
      });

      expect(isOk(resultado)).toBe(true);
      if (isOk(resultado)) {
        expect(resultado.value.fotoUrl).toBeNull();
      }
    });

    it("rechaza un nombre vacío (invariante de dominio)", async () => {
      const resultado = await gestionar.crear({
        nombre: "   ",
        categoriaId: "cat-1",
        precio: Money.de(1),
        stockDelDia: 1,
        disponible: true,
      });

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_NOMBRE_VACIO");
      }
      expect(await menu.listar()).toHaveLength(0);
    });

    it("rechaza un precio negativo (invariante de dominio)", async () => {
      const resultado = await gestionar.crear({
        nombre: "Plato",
        categoriaId: "cat-1",
        precio: Money.de(-1),
        stockDelDia: 1,
        disponible: true,
      });

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_PRECIO_NEGATIVO");
      }
      expect(await menu.listar()).toHaveLength(0);
    });

    it("rechaza un stock no entero (invariante de dominio)", async () => {
      const resultado = await gestionar.crear({
        nombre: "Plato",
        categoriaId: "cat-1",
        precio: Money.de(1),
        stockDelDia: 1.5,
        disponible: true,
      });

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_STOCK_NO_ENTERO");
      }
    });
  });

  describe("editar", () => {
    beforeEach(() => {
      menu.agregar(
        MenuItem.crear({
          id: "plato-existente",
          nombre: "Original",
          categoriaId: "cat-1",
          precio: Money.de(10),
          fotoUrl: "https://cdn/original.jpg",
          stockDelDia: 8,
          disponible: true,
        }),
      );
    });

    it("aplica solo los campos provistos y conserva el resto", async () => {
      const resultado = await gestionar.editar("plato-existente", {
        nombre: "Editado",
        precio: Money.de(15),
      });

      expect(isOk(resultado)).toBe(true);
      if (isOk(resultado)) {
        const item = resultado.value;
        expect(item.nombre).toBe("Editado");
        expect(item.precio.toDecimal()).toBe(15);
        // Campos no provistos conservan su valor.
        expect(item.categoriaId).toBe("cat-1");
        expect(item.fotoUrl).toBe("https://cdn/original.jpg");
        expect(item.stockDelDia).toBe(8);
        expect(item.disponible).toBe(true);
      }
    });

    it("permite borrar la foto pasando fotoUrl null explícito", async () => {
      const resultado = await gestionar.editar("plato-existente", {
        fotoUrl: null,
      });

      expect(isOk(resultado)).toBe(true);
      if (isOk(resultado)) {
        expect(resultado.value.fotoUrl).toBeNull();
      }
    });

    it("retorna error si el Plato no existe", async () => {
      const resultado = await gestionar.editar("inexistente", {
        nombre: "X",
      });

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_NO_ENCONTRADO");
      }
    });

    it("propaga el error de invariante al editar con un valor inválido", async () => {
      const resultado = await gestionar.editar("plato-existente", {
        precio: Money.de(-5),
      });

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_PRECIO_NEGATIVO");
      }
      // El plato persistido conserva su precio original.
      const guardado = await menu.obtener("plato-existente");
      expect(guardado?.precio.toDecimal()).toBe(10);
    });
  });

  describe("eliminar", () => {
    it("elimina un Plato existente", async () => {
      menu.agregar(
        MenuItem.crear({
          id: "plato-borrar",
          nombre: "Borrar",
          categoriaId: "cat-1",
          precio: Money.de(3),
          stockDelDia: 2,
          disponible: true,
        }),
      );

      const resultado = await gestionar.eliminar("plato-borrar");

      expect(isOk(resultado)).toBe(true);
      expect(await menu.obtener("plato-borrar")).toBeNull();
    });

    it("retorna error si el Plato a eliminar no existe", async () => {
      const resultado = await gestionar.eliminar("inexistente");

      expect(isErr(resultado)).toBe(true);
      if (isErr(resultado)) {
        expect(resultado.error.code).toBe("MENU_ITEM_NO_ENCONTRADO");
      }
    });
  });
});
