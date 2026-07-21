import { describe, expect, it } from "vitest";

import type { MenuItemDTO } from "@/presentation/http/dto";

import {
  PLATO_DRAFT_VACIO,
  draftAPayload,
  etiquetaDisponibilidad,
  itemADraft,
  mensajeConfirmarEliminar,
  platoDraftValido,
} from "./menu";

const item: MenuItemDTO = {
  id: "m1",
  nombre: "Ceviche",
  categoriaId: "cat-1",
  precio: 8.5,
  fotoUrl: null,
  stockDelDia: 10,
  disponible: true,
};

describe("etiquetaDisponibilidad", () => {
  it("Disponible con stock y disponible", () => {
    expect(etiquetaDisponibilidad(item)).toBe("Disponible");
  });

  it("Agotado cuando stock 0 aunque disponible", () => {
    expect(etiquetaDisponibilidad({ ...item, stockDelDia: 0 })).toBe("Agotado");
  });

  it("No disponible cuando forzado", () => {
    expect(etiquetaDisponibilidad({ ...item, disponible: false })).toBe(
      "No disponible",
    );
  });
});

describe("platoDraftValido", () => {
  it("rechaza el borrador vacío", () => {
    expect(platoDraftValido(PLATO_DRAFT_VACIO)).toBe(false);
  });

  it("acepta un borrador completo", () => {
    expect(
      platoDraftValido({
        nombre: "Ceviche",
        categoriaId: "cat-1",
        precio: "8.5",
        stockDelDia: "10",
        fotoUrl: "",
      }),
    ).toBe(true);
  });

  it("rechaza precio no positivo y stock negativo", () => {
    const base = {
      nombre: "X",
      categoriaId: "c",
      precio: "0",
      stockDelDia: "5",
      fotoUrl: "",
    };
    expect(platoDraftValido(base)).toBe(false);
    expect(platoDraftValido({ ...base, precio: "5", stockDelDia: "-1" })).toBe(
      false,
    );
  });

  it("acepta stock 0 (agotado pero válido)", () => {
    expect(
      platoDraftValido({
        nombre: "X",
        categoriaId: "c",
        precio: "5",
        stockDelDia: "0",
        fotoUrl: "",
      }),
    ).toBe(true);
  });
});

describe("draftAPayload / itemADraft", () => {
  it("convierte texto a números y vacío de foto a null", () => {
    expect(
      draftAPayload({
        nombre: " Ceviche ",
        categoriaId: " cat-1 ",
        precio: "8.5",
        stockDelDia: "10",
        fotoUrl: "  ",
      }),
    ).toEqual({
      nombre: "Ceviche",
      categoriaId: "cat-1",
      precio: 8.5,
      stockDelDia: 10,
      fotoUrl: null,
    });
  });

  it("itemADraft es reversible con draftAPayload", () => {
    const draft = itemADraft(item);
    expect(draftAPayload(draft)).toEqual({
      nombre: "Ceviche",
      categoriaId: "cat-1",
      precio: 8.5,
      stockDelDia: 10,
      fotoUrl: null,
    });
  });
});

describe("mensajeConfirmarEliminar", () => {
  it("incluye el nombre", () => {
    expect(mensajeConfirmarEliminar("Ceviche")).toContain("Ceviche");
    expect(mensajeConfirmarEliminar("Ceviche")).toContain("¿Continuar?");
  });
});
