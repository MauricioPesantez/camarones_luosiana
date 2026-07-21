import { describe, expect, it } from "vitest";

import type { SessionUser } from "@/application/ports/AuthService";
import { Role } from "@/domain/user/Role";

import { autorizado, esRutaPublica, reglaDe } from "./middleware";

function usuario(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "u-1",
    usuario: "test",
    nombre: "Test",
    roles: [Role.MESERO],
    puedeCobrar: false,
    ...overrides,
  };
}

describe("esRutaPublica", () => {
  it("marca login y su API como públicas", () => {
    expect(esRutaPublica("/login")).toBe(true);
    expect(esRutaPublica("/api/auth/login")).toBe(true);
  });

  it("no marca rutas protegidas como públicas", () => {
    expect(esRutaPublica("/caja")).toBe(false);
    expect(esRutaPublica("/")).toBe(false);
  });
});

describe("reglaDe", () => {
  it("resuelve rutas de admin", () => {
    expect(reglaDe("/caja")).toEqual({ roles: [Role.ADMIN] });
    expect(reglaDe("/usuarios/nuevo")).toEqual({ roles: [Role.ADMIN] });
  });

  it("resuelve /cobrar por permiso, no por rol", () => {
    expect(reglaDe("/cobrar")).toEqual({ permiso: "cobrar" });
  });

  it("resuelve el KDS para cocina y admin", () => {
    expect(reglaDe("/kds")).toEqual({ roles: [Role.COCINA, Role.ADMIN] });
  });

  it("usa la raíz como catch-all para cualquier autenticado", () => {
    expect(reglaDe("/")).toEqual({
      roles: [Role.MESERO, Role.OPERADOR, Role.COCINA, Role.ADMIN],
    });
    expect(reglaDe("/ruta-desconocida")).toEqual({
      roles: [Role.MESERO, Role.OPERADOR, Role.COCINA, Role.ADMIN],
    });
  });
});

describe("autorizado", () => {
  it("admite un rol presente en la regla (R2.2)", () => {
    expect(autorizado(usuario({ roles: [Role.ADMIN] }), { roles: [Role.ADMIN] })).toBe(
      true,
    );
  });

  it("deniega cuando ningún rol coincide (R2.5)", () => {
    expect(
      autorizado(usuario({ roles: [Role.MESERO] }), { roles: [Role.ADMIN] }),
    ).toBe(false);
  });

  it("exige puedeCobrar para el permiso de cobro (R2.3, R2.4)", () => {
    expect(autorizado(usuario({ puedeCobrar: true }), { permiso: "cobrar" })).toBe(
      true,
    );
    expect(autorizado(usuario({ puedeCobrar: false }), { permiso: "cobrar" })).toBe(
      false,
    );
  });

  it("admite a cualquier autenticado en una regla vacía", () => {
    expect(autorizado(usuario(), {})).toBe(true);
  });
});
