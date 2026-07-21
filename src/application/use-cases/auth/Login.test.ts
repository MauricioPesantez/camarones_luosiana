import { describe, it, expect, beforeEach } from "vitest";

import type { AuthService, SessionUser } from "@/application/ports/AuthService";
import type { UserRepository } from "@/application/ports/UserRepository";
import { isErr, isOk } from "@/domain/shared/Result";
import { Role } from "@/domain/user/Role";
import { User } from "@/domain/user/User";

import { CREDENCIALES_INVALIDAS, Login } from "./Login";

/**
 * Repositorio de usuarios en memoria para tests. Implementa el puerto completo
 * sin DB. La clave "correcta" se modela guardando el hash como `hash:<clave>`.
 */
class FakeUserRepository implements UserRepository {
  private readonly porId = new Map<string, User>();
  private readonly porNombre = new Map<string, User>();

  agregar(user: User): void {
    this.porId.set(user.id, user);
    this.porNombre.set(user.usuario, user);
  }

  async porUsuario(usuario: string): Promise<User | null> {
    return this.porNombre.get(usuario) ?? null;
  }

  async obtener(id: string): Promise<User | null> {
    return this.porId.get(id) ?? null;
  }

  async listar(): Promise<User[]> {
    return [...this.porId.values()];
  }

  async guardar(u: User): Promise<void> {
    this.agregar(u);
  }
}

/**
 * AuthService stub: la clave es válida cuando `hash === "hash:" + clave`.
 * `emitirSesion` devuelve un token determinista derivado del usuario.
 */
class StubAuthService implements AuthService {
  emitidos: SessionUser[] = [];

  async verificarClave(clave: string, hash: string): Promise<boolean> {
    return hash === `hash:${clave}`;
  }

  async hashClave(clave: string): Promise<string> {
    return `hash:${clave}`;
  }

  async emitirSesion(user: SessionUser): Promise<string> {
    this.emitidos.push(user);
    return `token-${user.usuario}`;
  }

  async verificarSesion(): Promise<SessionUser | null> {
    return null;
  }
}

function crearUsuario(overrides: Partial<Parameters<typeof User.crear>[0]> = {}) {
  return User.crear({
    id: "user-1",
    usuario: "mesero1",
    claveHash: "hash:secreta",
    nombre: "Mesero Uno",
    roles: [Role.MESERO],
    puedeCobrar: false,
    activo: true,
    ...overrides,
  });
}

describe("Login", () => {
  let repo: FakeUserRepository;
  let auth: StubAuthService;
  let login: Login;

  beforeEach(() => {
    repo = new FakeUserRepository();
    auth = new StubAuthService();
    login = new Login(repo, auth);
  });

  it("emite sesión con credenciales válidas", async () => {
    repo.agregar(crearUsuario());

    const resultado = await login.ejecutar({
      usuario: "mesero1",
      clave: "secreta",
    });

    expect(isOk(resultado)).toBe(true);
    if (isOk(resultado)) {
      expect(resultado.value.token).toBe("token-mesero1");
      expect(resultado.value.usuario).toEqual({
        id: "user-1",
        usuario: "mesero1",
        nombre: "Mesero Uno",
        roles: [Role.MESERO],
        puedeCobrar: false,
      });
    }
    expect(auth.emitidos).toHaveLength(1);
  });

  it("rechaza con credenciales inválidas si la clave es incorrecta", async () => {
    repo.agregar(crearUsuario());

    const resultado = await login.ejecutar({
      usuario: "mesero1",
      clave: "equivocada",
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe(CREDENCIALES_INVALIDAS);
      expect(resultado.error.message).toBe("Credenciales inválidas");
    }
    expect(auth.emitidos).toHaveLength(0);
  });

  it("rechaza con el mismo error genérico si el usuario no existe", async () => {
    const resultado = await login.ejecutar({
      usuario: "fantasma",
      clave: "loquesea",
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe(CREDENCIALES_INVALIDAS);
      expect(resultado.error.message).toBe("Credenciales inválidas");
    }
    expect(auth.emitidos).toHaveLength(0);
  });

  it("no revela diferencia entre usuario inexistente y clave incorrecta", async () => {
    repo.agregar(crearUsuario());

    const claveMala = await login.ejecutar({
      usuario: "mesero1",
      clave: "equivocada",
    });
    const usuarioMalo = await login.ejecutar({
      usuario: "fantasma",
      clave: "secreta",
    });

    expect(isErr(claveMala) && isErr(usuarioMalo)).toBe(true);
    if (isErr(claveMala) && isErr(usuarioMalo)) {
      expect(claveMala.error.code).toBe(usuarioMalo.error.code);
      expect(claveMala.error.message).toBe(usuarioMalo.error.message);
    }
  });

  it("rechaza el login de un usuario desactivado", async () => {
    repo.agregar(crearUsuario({ activo: false }));

    const resultado = await login.ejecutar({
      usuario: "mesero1",
      clave: "secreta",
    });

    expect(isErr(resultado)).toBe(true);
    if (isErr(resultado)) {
      expect(resultado.error.code).toBe("AUTH_USUARIO_INACTIVO");
    }
    expect(auth.emitidos).toHaveLength(0);
  });
});
