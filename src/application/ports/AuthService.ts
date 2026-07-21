import { Role } from "@/domain/user/Role";

/**
 * Datos mínimos del usuario embebidos en la sesión (JWT).
 * Suficientes para resolver autorización sin consultar la DB en cada request.
 */
export interface SessionUser {
  id: string;
  usuario: string;
  nombre: string;
  roles: Role[];
  puedeCobrar: boolean;
}

/**
 * Facade de autenticación (R1).
 *
 * Abstrae el hashing de claves y la emisión/verificación de sesiones (JWT).
 * La implementación concreta vive en infraestructura (`JwtAuthService`).
 */
export interface AuthService {
  /** Verifica si una clave en texto plano coincide con su hash almacenado. */
  verificarClave(clave: string, hash: string): Promise<boolean>;

  /** Genera el hash de una clave para almacenamiento seguro. */
  hashClave(clave: string): Promise<string>;

  /** Emite un token de sesión (JWT) para el usuario dado. */
  emitirSesion(user: SessionUser): Promise<string>;

  /** Verifica un token de sesión y retorna los datos del usuario, o `null` si es inválido/expirado. */
  verificarSesion(token: string): Promise<SessionUser | null>;
}
