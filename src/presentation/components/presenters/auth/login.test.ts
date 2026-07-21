import { describe, expect, it } from "vitest";

import { REDIRECT_POR_DEFECTO, puedeIniciar, redirectSeguro } from "./login";

describe("puedeIniciar", () => {
  it("exige usuario y clave no vacíos", () => {
    expect(puedeIniciar("admin", "x")).toBe(true);
    expect(puedeIniciar("", "x")).toBe(false);
    expect(puedeIniciar("admin", "")).toBe(false);
    expect(puedeIniciar("   ", "x")).toBe(false);
  });
});

describe("redirectSeguro", () => {
  it("acepta rutas internas absolutas", () => {
    expect(redirectSeguro("/orden")).toBe("/orden");
    expect(redirectSeguro("/admin/menu")).toBe("/admin/menu");
  });

  it("rechaza destinos externos y protocol-relative", () => {
    expect(redirectSeguro("http://evil.com")).toBe(REDIRECT_POR_DEFECTO);
    expect(redirectSeguro("//evil.com")).toBe(REDIRECT_POR_DEFECTO);
    expect(redirectSeguro("https://evil.com/x")).toBe(REDIRECT_POR_DEFECTO);
  });

  it("cae al destino por defecto ante vacío o nulo", () => {
    expect(redirectSeguro(null)).toBe(REDIRECT_POR_DEFECTO);
    expect(redirectSeguro(undefined)).toBe(REDIRECT_POR_DEFECTO);
    expect(redirectSeguro("")).toBe(REDIRECT_POR_DEFECTO);
    expect(redirectSeguro("relativo")).toBe(REDIRECT_POR_DEFECTO);
  });
});
