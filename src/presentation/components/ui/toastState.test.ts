import { describe, expect, it } from "vitest";

import { toastReducer, type Toast } from "./toastState";

describe("toastReducer", () => {
  it("apila un toast nuevo al final", () => {
    const state = toastReducer([], { type: "push", id: "t1", text: "Hola" });
    expect(state).toEqual([{ id: "t1", text: "Hola" }]);
  });

  it("preserva el orden de llegada al apilar varios", () => {
    let state: Toast[] = [];
    state = toastReducer(state, { type: "push", id: "t1", text: "uno" });
    state = toastReducer(state, { type: "push", id: "t2", text: "dos" });
    expect(state.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("ignora un id duplicado", () => {
    const base = toastReducer([], { type: "push", id: "t1", text: "uno" });
    const next = toastReducer(base, { type: "push", id: "t1", text: "otra vez" });
    expect(next).toHaveLength(1);
    expect(next[0].text).toBe("uno");
  });

  it("descarta solo el toast indicado", () => {
    let state: Toast[] = [];
    state = toastReducer(state, { type: "push", id: "t1", text: "uno" });
    state = toastReducer(state, { type: "push", id: "t2", text: "dos" });
    state = toastReducer(state, { type: "dismiss", id: "t1" });
    expect(state.map((t) => t.id)).toEqual(["t2"]);
  });

  it("descartar un id inexistente no altera el estado", () => {
    const base = toastReducer([], { type: "push", id: "t1", text: "uno" });
    const next = toastReducer(base, { type: "dismiss", id: "zzz" });
    expect(next).toEqual(base);
  });
});
