import { describe, it, expect } from "vitest";
import { Category } from "./Category";
import { DomainError } from "../shared/DomainError";

describe("Category", () => {
  it("crea una categoría válida y recorta el nombre", () => {
    const cat = Category.crear({ id: "cat-1", nombre: "  Ceviches  " });
    expect(cat.id).toBe("cat-1");
    expect(cat.nombre).toBe("Ceviches");
  });

  it("rechaza nombre vacío", () => {
    expect(() => Category.crear({ id: "cat-1", nombre: "   " })).toThrow(
      DomainError,
    );
  });

  it("renombra exigiendo nombre no vacío", () => {
    const cat = Category.crear({ id: "cat-1", nombre: "Bebidas" });
    cat.renombrar("Bebidas frías");
    expect(cat.nombre).toBe("Bebidas frías");
    expect(() => cat.renombrar("  ")).toThrow(DomainError);
  });
});
