import { describe, expect, it } from "vitest";

import { etiquetaAccion, formatFechaHora, resumenDetalle } from "./auditoria";

describe("etiquetaAccion", () => {
  it("traduce acciones conocidas", () => {
    expect(etiquetaAccion("CERRAR_CAJA")).toBe("Cerrar caja");
  });

  it("devuelve el código crudo si es desconocida", () => {
    expect(etiquetaAccion("ALGO_RARO")).toBe("ALGO_RARO");
  });
});

describe("formatFechaHora", () => {
  it("devuelve el ISO tal cual si es inválido", () => {
    expect(formatFechaHora("no-es-fecha")).toBe("no-es-fecha");
  });

  it("formatea una fecha válida sin lanzar", () => {
    expect(formatFechaHora("2026-07-12T15:30:00.000Z")).not.toBe("");
  });
});

describe("resumenDetalle", () => {
  it("cadena vacía si no hay detalle", () => {
    expect(resumenDetalle(null)).toBe("");
    expect(resumenDetalle({})).toBe("");
  });

  it("resume pares clave/valor", () => {
    expect(resumenDetalle({ esperado: 100, diferencia: -5 })).toBe(
      "esperado: 100 · diferencia: -5",
    );
  });

  it("serializa objetos anidados", () => {
    expect(resumenDetalle({ item: { id: "x" } })).toBe('item: {"id":"x"}');
  });
});
