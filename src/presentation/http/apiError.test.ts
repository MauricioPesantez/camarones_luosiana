import { describe, expect, it } from "vitest";

import { CREDENCIALES_INVALIDAS } from "@/application/use-cases/auth/Login";

import { statusDeCodigo } from "./apiError";

describe("statusDeCodigo", () => {
  it("mapea entidades inexistentes a 404", () => {
    expect(statusDeCodigo("ORDER_NO_ENCONTRADA")).toBe(404);
    expect(statusDeCodigo("MENU_ITEM_NO_ENCONTRADO")).toBe(404);
  });

  it("mapea denegaciones de autorización a 403", () => {
    expect(statusDeCodigo("CAJA_CERRAR_NO_AUTORIZADO")).toBe(403);
    expect(statusDeCodigo("ORDER_CANCELACION_REQUIERE_ADMIN")).toBe(403);
  });

  it("mapea credenciales inválidas y cuenta inactiva a 401", () => {
    expect(statusDeCodigo(CREDENCIALES_INVALIDAS)).toBe(401);
    expect(statusDeCodigo("AUTH_USUARIO_INACTIVO")).toBe(401);
  });

  it("mapea el resto de violaciones de regla de negocio a 422 (incl. R6.7)", () => {
    expect(statusDeCodigo("ORDER_TRANSICION_INVALIDA")).toBe(422);
    expect(statusDeCodigo("MENU_ITEM_STOCK_INSUFICIENTE")).toBe(422);
    expect(statusDeCodigo("DOMAIN_ERROR")).toBe(422);
  });
});
