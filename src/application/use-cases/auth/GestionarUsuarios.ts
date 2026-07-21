import { randomUUID } from "crypto";

import type { AuthService } from "@/application/ports/AuthService";
import type { UserRepository } from "@/application/ports/UserRepository";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";
import type { Role } from "@/domain/user/Role";
import { User } from "@/domain/user/User";

/**
 * Datos para crear un nuevo usuario.
 */
export interface CrearUsuarioInput {
  usuario: string;
  nombre: string;
  clave: string;
  roles: Role[];
  puedeCobrar?: boolean;
}

/**
 * Caso de uso `GestionarUsuarios` (R2.1, R2.6).
 *
 * Administra el ciclo de vida de los usuarios: alta (con clave hasheada),
 * edición, desactivación, y la asignación/revocación de roles y del permiso de
 * cobro. Toda la persistencia pasa por el `UserRepository`.
 *
 * Los métodos devuelven `Result<T, DomainError>`: no lanzan ante violaciones de
 * reglas de negocio, sino que retornan el error tipado.
 */
export class GestionarUsuarios {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
  ) {}

  /** Crea un usuario nuevo con la clave hasheada (R2.1). */
  async crear(input: CrearUsuarioInput): Promise<Result<User>> {
    const usuario = input.usuario?.trim() ?? "";

    const existente = await this.userRepository.porUsuario(usuario);
    if (existente) {
      return err(
        new DomainError(
          "Ya existe un usuario con ese nombre de usuario",
          "USER_USUARIO_DUPLICADO",
        ),
      );
    }

    const claveHash = await this.authService.hashClave(input.clave);

    return this.tryDomain(() => {
      const user = User.crear({
        id: randomUUID(),
        usuario,
        claveHash,
        nombre: input.nombre,
        roles: input.roles,
        puedeCobrar: input.puedeCobrar ?? false,
        activo: true,
      });
      return user;
    }).then(async (resultado) => {
      if (!resultado.ok) {
        return resultado;
      }
      await this.userRepository.guardar(resultado.value);
      return resultado;
    });
  }

  /** Cambia el nombre visible de un usuario. */
  async editarNombre(id: string, nombre: string): Promise<Result<User>> {
    return this.mutar(id, (user) => user.cambiarNombre(nombre));
  }

  /** Reemplaza la clave de un usuario por el hash de la nueva clave. */
  async cambiarClave(id: string, nuevaClave: string): Promise<Result<User>> {
    const user = await this.userRepository.obtener(id);
    if (!user) {
      return err(this.noEncontrado(id));
    }
    const claveHash = await this.authService.hashClave(nuevaClave);
    user.cambiarClave(claveHash);
    await this.userRepository.guardar(user);
    return ok(user);
  }

  /** Desactiva un usuario (R2.6). */
  async desactivar(id: string): Promise<Result<User>> {
    return this.mutar(id, (user) => user.desactivar());
  }

  /** Reactiva un usuario previamente desactivado. */
  async activar(id: string): Promise<Result<User>> {
    return this.mutar(id, (user) => user.activar());
  }

  /** Asigna un rol a un usuario (R2.6). */
  async asignarRol(id: string, rol: Role): Promise<Result<User>> {
    return this.mutar(id, (user) => user.asignarRol(rol));
  }

  /** Revoca un rol de un usuario, sin dejarlo sin roles (R2.6). */
  async revocarRol(id: string, rol: Role): Promise<Result<User>> {
    const user = await this.userRepository.obtener(id);
    if (!user) {
      return err(this.noEncontrado(id));
    }
    if (user.roles.length === 1 && user.tieneRol(rol)) {
      return err(
        new DomainError(
          "El usuario debe conservar al menos un rol",
          "USER_ROLES_VACIOS",
        ),
      );
    }
    user.revocarRol(rol);
    await this.userRepository.guardar(user);
    return ok(user);
  }

  /** Habilita o deshabilita el permiso de cobro de un usuario (R2.6). */
  async establecerPuedeCobrar(
    id: string,
    puede: boolean,
  ): Promise<Result<User>> {
    return this.mutar(id, (user) => user.establecerPuedeCobrar(puede));
  }

  /** Obtiene un usuario por id. */
  async obtener(id: string): Promise<Result<User>> {
    const user = await this.userRepository.obtener(id);
    return user ? ok(user) : err(this.noEncontrado(id));
  }

  /** Lista todos los usuarios. */
  async listar(): Promise<User[]> {
    return this.userRepository.listar();
  }

  /**
   * Carga un usuario por id, le aplica una mutación de dominio y lo persiste.
   * Centraliza el patrón obtener → mutar → guardar.
   */
  private async mutar(
    id: string,
    mutacion: (user: User) => void,
  ): Promise<Result<User>> {
    const user = await this.userRepository.obtener(id);
    if (!user) {
      return err(this.noEncontrado(id));
    }
    try {
      mutacion(user);
    } catch (e) {
      if (e instanceof DomainError) {
        return err(e);
      }
      throw e;
    }
    await this.userRepository.guardar(user);
    return ok(user);
  }

  /** Ejecuta una construcción de dominio capturando `DomainError` como `Result`. */
  private async tryDomain(fn: () => User): Promise<Result<User>> {
    try {
      return ok(fn());
    } catch (e) {
      if (e instanceof DomainError) {
        return err(e);
      }
      throw e;
    }
  }

  private noEncontrado(id: string): DomainError {
    return new DomainError(
      `No existe un usuario con id ${id}`,
      "USER_NO_ENCONTRADO",
    );
  }
}
