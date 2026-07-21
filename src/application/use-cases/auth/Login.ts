import type { AuthService, SessionUser } from "@/application/ports/AuthService";
import type { UserRepository } from "@/application/ports/UserRepository";
import { DomainError } from "@/domain/shared/DomainError";
import { Result, err, ok } from "@/domain/shared/Result";
import type { User } from "@/domain/user/User";

/**
 * Datos de entrada para iniciar sesión.
 */
export interface LoginInput {
  usuario: string;
  clave: string;
}

/**
 * Resultado de un login exitoso: el token de sesión (JWT) y los datos del
 * usuario embebidos en la sesión.
 */
export interface LoginResult {
  token: string;
  usuario: SessionUser;
}

/**
 * Mensaje genérico de credenciales inválidas (R1.2, R1.3).
 *
 * Es intencionalmente ambiguo: no revela si el usuario no existe o si la clave
 * es incorrecta, para no filtrar la existencia de cuentas.
 */
export const CREDENCIALES_INVALIDAS = "AUTH_CREDENCIALES_INVALIDAS";

/**
 * Caso de uso `Login` (R1.1, R1.2, R1.3).
 *
 * Busca al usuario por su nombre de usuario, verifica la clave contra el hash
 * almacenado y, si todo es válido, emite una sesión. Tanto el usuario
 * inexistente como la clave incorrecta producen el mismo error genérico de
 * credenciales inválidas.
 */
export class Login {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
  ) {}

  async ejecutar(input: LoginInput): Promise<Result<LoginResult>> {
    const usuario = input.usuario?.trim() ?? "";
    const clave = input.clave ?? "";

    // No revelar si el usuario existe o no: mismo error en ambos casos (R1.3).
    const user = await this.userRepository.porUsuario(usuario);
    if (!user) {
      return err(
        new DomainError("Credenciales inválidas", CREDENCIALES_INVALIDAS),
      );
    }

    // Clave incorrecta: mismo error genérico (R1.2).
    const claveValida = await this.authService.verificarClave(
      clave,
      user.claveHash,
    );
    if (!claveValida) {
      return err(
        new DomainError("Credenciales inválidas", CREDENCIALES_INVALIDAS),
      );
    }

    // Un usuario desactivado no puede iniciar sesión.
    if (!user.activo) {
      return err(
        new DomainError("La cuenta está desactivada", "AUTH_USUARIO_INACTIVO"),
      );
    }

    const sessionUser = this.toSessionUser(user);
    const token = await this.authService.emitirSesion(sessionUser);

    return ok({ token, usuario: sessionUser });
  }

  private toSessionUser(user: User): SessionUser {
    return {
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      roles: [...user.roles],
      puedeCobrar: user.puedeCobrar,
    };
  }
}
