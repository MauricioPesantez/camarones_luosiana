import { describe, expect, it } from "vitest";

import { Role } from "@/domain/user/Role";

import {
  esRutaActiva,
  landingPara,
  navPara,
  puedeVer,
  type PerfilNav,
} from "./nav";

const perfil = (roles: Role[], puedeCobrar = false): PerfilNav => ({
  roles,
  puedeCobrar,
});

describe("navPara", () => {
  it("mesero solo ve Órdenes", () => {
    const links = navPara(perfil([Role.MESERO])).map((e) => e.href);
    expect(links).toEqual(["/orden"]);
  });

  it("cocina solo ve Cocina", () => {
    const links = navPara(perfil([Role.COCINA])).map((e) => e.href);
    expect(links).toEqual(["/kds"]);
  });

  it("operador sin puedeCobrar no ve Cobrar", () => {
    const links = navPara(perfil([Role.OPERADOR])).map((e) => e.href);
    expect(links).toEqual(["/orden"]);
  });

  it("operador con puedeCobrar ve Órdenes y Cobrar", () => {
    const links = navPara(perfil([Role.OPERADOR], true)).map((e) => e.href);
    expect(links).toEqual(["/orden", "/cobrar"]);
  });

  it("admin ve todo", () => {
    const links = navPara(perfil([Role.ADMIN], true)).map((e) => e.href);
    expect(links).toEqual(["/orden", "/kds", "/cobrar", "/caja", "/admin"]);
  });
});

describe("puedeVer", () => {
  it("cobrar exige puedeCobrar aunque el rol coincida por otra vía", () => {
    const cobrar = { href: "/cobrar", label: "Cobrar", permiso: "cobrar" as const };
    expect(puedeVer(perfil([Role.ADMIN], false), cobrar)).toBe(false);
    expect(puedeVer(perfil([Role.ADMIN], true), cobrar)).toBe(true);
  });
});

describe("landingPara", () => {
  it("admin aterriza en /admin", () => {
    expect(landingPara(perfil([Role.ADMIN], true))).toBe("/admin");
  });

  it("mesero aterriza en /orden", () => {
    expect(landingPara(perfil([Role.MESERO]))).toBe("/orden");
  });

  it("cocina aterriza en /kds", () => {
    expect(landingPara(perfil([Role.COCINA]))).toBe("/kds");
  });

  it("perfil sin enlaces cae a la raíz", () => {
    expect(landingPara(perfil([]))).toBe("/");
  });
});

describe("esRutaActiva", () => {
  it("coincide exacto y por prefijo de subruta", () => {
    expect(esRutaActiva("/admin", "/admin")).toBe(true);
    expect(esRutaActiva("/admin/menu", "/admin")).toBe(true);
    expect(esRutaActiva("/orden", "/admin")).toBe(false);
  });

  it("no confunde prefijos de nombre distinto", () => {
    expect(esRutaActiva("/ordenar-algo", "/orden")).toBe(false);
  });
});
