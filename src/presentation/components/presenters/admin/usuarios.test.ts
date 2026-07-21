import { describe, expect, it } from "vitest";

import { Role } from "@/domain/user/Role";
import type { UserDTO } from "@/presentation/http/dto";

import {
  USUARIO_DRAFT_VACIO,
  alternarRol,
  mensajeConfirmarDesactivar,
  mensajeEstadoUsuario,
  resumenRoles,
  tieneRol,
  usuarioDraftValido,
} from "./usuarios";

const user: UserDTO = {
  id: "u1",
  usuario: "jdoe",
  nombre: "John Doe",
  roles: [Role.MESERO, Role.ADMIN],
  puedeCobrar: true,
  activo: true,
};

describe("tieneRol / resumenRoles", () => {
  it("detecta un rol presente y ausente", () => {
    expect(tieneRol(user, Role.ADMIN)).toBe(true);
    expect(tieneRol(user, Role.COCINA)).toBe(false);
  });

  it("resume roles con etiquetas legibles", () => {
    expect(resumenRoles(user)).toBe("Mesero, Administrador");
    expect(resumenRoles({ ...user, roles: [] })).toBe("Sin roles");
  });
});

describe("usuarioDraftValido", () => {
  it("rechaza el borrador vacío", () => {
    expect(usuarioDraftValido(USUARIO_DRAFT_VACIO)).toBe(false);
  });

  it("exige al menos un rol", () => {
    expect(
      usuarioDraftValido({
        usuario: "a",
        nombre: "b",
        clave: "c",
        roles: [],
        puedeCobrar: false,
      }),
    ).toBe(false);
  });

  it("acepta un borrador completo", () => {
    expect(
      usuarioDraftValido({
        usuario: "a",
        nombre: "b",
        clave: "c",
        roles: [Role.MESERO],
        puedeCobrar: false,
      }),
    ).toBe(true);
  });
});

describe("alternarRol", () => {
  it("agrega un rol ausente y quita uno presente", () => {
    expect(alternarRol([], Role.MESERO)).toEqual([Role.MESERO]);
    expect(alternarRol([Role.MESERO], Role.MESERO)).toEqual([]);
  });

  it("no muta la lista original", () => {
    const roles = [Role.MESERO];
    alternarRol(roles, Role.ADMIN);
    expect(roles).toEqual([Role.MESERO]);
  });
});

describe("mensajes", () => {
  it("estado según activo", () => {
    expect(mensajeEstadoUsuario(true)).toBe("Usuario activado");
    expect(mensajeEstadoUsuario(false)).toBe("Usuario desactivado");
  });

  it("confirmar desactivar incluye el nombre", () => {
    expect(mensajeConfirmarDesactivar("John")).toContain("John");
    expect(mensajeConfirmarDesactivar("John")).toContain("¿Continuar?");
  });
});
