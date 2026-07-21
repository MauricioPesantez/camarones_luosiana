import { describe, it, expect, beforeEach } from "vitest";

import type { AuthService, SessionUser } from "@/application/ports/AuthService";
import type { UserRepository } from "@/application/ports/UserRepository";
import { isErr, isOk } from "@/domain/shared/Result";
import { Role } from "@/domain/user/Role";
import { User } from "@/domain/user/User";

import { GestionarUsuarios } from "./GestionarUsuarios";

class FakeUserRepository implements UserRepository {
  readonly porId = new Map<string, User>();

  async porUsuario(usuario: string): Promise<User | null> {
    for (const u of this.porId.values()) {
      if (u.usuario === usuario) return u;
    }
    return null;
  }

  async obtener(id: string): Promise<User | null> {
    return this.porId.get(id) ?? null;
  }

  async listar(): Promise<User[]> {
    return [...this.porId.values()];
  }

  async guardar(u: User): Promise<void> {
    this.porId.set(u.id, u);
  }
}

class StubAuthService implements AuthService {
  async verificarClave(clave: string, hash: string): Promise<boolean> {
    return hash === `hash:${clave}`;
  }
  async hashClave(clave: string): Promise<string> {
    return `hash:${clave}`;
  }
  async emitirSesion(): Promise<string> {
    return "token";
  }
  async verificarSesion(): Promise<SessionUser | null> {
    return null;
  }
}

describe("GestionarUsuarios", () => {
  let repo: FakeUserRepository;
  let gestion: GestionarUsuarios;

  beforeEach(() => {
    repo = new FakeUserRepository();
    gestion = new GestionarUsuarios(repo, new StubAuthService());
  });

  it("crea un usuario con la clave hasheada y lo persiste", async () => {
    const resultado = await gestion.crear({
      usuario: "admin1",
      nombre: "Admin Uno",
      clave: "secreta",
      roles: [Role.ADMIN],
      puedeCobrar: true,
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      const user = resultado.value;
      expect(user.usuario).toBe("admin1");
      expect(user.claveHash).toBe("hash:secreta");
      expect(user.puedeCobrar).toBe(true);
      expect(repo.porId.get(user.id)).toBe(user);
    }
  });

  it("rechaza un nombre de usuario duplicado", async () => {
    await gestion.crear({
      usuario: "dup",
      nombre: "Uno",
      clave: "x",
      roles: [Role.MESERO],
    });

    const resultado = await gestion.crear({
      usuario: "dup",
      nombre: "Dos",
      clave: "y",
      roles: [Role.MESERO],
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("USER_USUARIO_DUPLICADO");
    }
  });

  it("asigna y revoca roles", async () => {
    const creado = await gestion.crear({
      usuario: "u",
      nombre: "U",
      clave: "x",
      roles: [Role.MESERO],
    });
    if (!isOk(creado)) throw new Error("no creado");
    const id = creado.value.id;

    const asignado = await gestion.asignarRol(id, Role.COCINA);
    expect(isOk(asignado)).toBe(true);
    if (isOk(asignado)) {
      expect(asignado.value.tieneRol(Role.COCINA)).toBe(true);
    }

    const revocado = await gestion.revocarRol(id, Role.MESERO);
    expect(isOk(revocado)).toBe(true);
    if (isOk(revocado)) {
      expect(revocado.value.tieneRol(Role.MESERO)).toBe(false);
      expect(revocado.value.tieneRol(Role.COCINA)).toBe(true);
    }
  });

  it("impide revocar el último rol de un usuario", async () => {
    const creado = await gestion.crear({
      usuario: "u",
      nombre: "U",
      clave: "x",
      roles: [Role.MESERO],
    });
    if (!isOk(creado)) throw new Error("no creado");

    const resultado = await gestion.revocarRol(creado.value.id, Role.MESERO);
    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("USER_ROLES_VACIOS");
    }
  });

  it("habilita y deshabilita el permiso de cobro", async () => {
    const creado = await gestion.crear({
      usuario: "u",
      nombre: "U",
      clave: "x",
      roles: [Role.OPERADOR],
    });
    if (!isOk(creado)) throw new Error("no creado");
    const id = creado.value.id;

    const habilitado = await gestion.establecerPuedeCobrar(id, true);
    expect(isOk(habilitado) && habilitado.value.puedeCobrar).toBe(true);

    const deshabilitado = await gestion.establecerPuedeCobrar(id, false);
    expect(isOk(deshabilitado) && deshabilitado.value.puedeCobrar).toBe(false);
  });

  it("desactiva un usuario existente", async () => {
    const creado = await gestion.crear({
      usuario: "u",
      nombre: "U",
      clave: "x",
      roles: [Role.MESERO],
    });
    if (!isOk(creado)) throw new Error("no creado");

    const resultado = await gestion.desactivar(creado.value.id);
    expect(isOk(resultado) && resultado.value.activo).toBe(false);
  });

  it("retorna error al operar sobre un id inexistente", async () => {
    const resultado = await gestion.desactivar("no-existe");
    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("USER_NO_ENCONTRADO");
    }
  });
});
