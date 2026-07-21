import bcrypt from "bcryptjs";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import type { AuthService, SessionUser } from "@/application/ports/AuthService";
import { Role } from "@/domain/user/Role";

/**
 * Número de rondas de sal para bcrypt. 10 es un equilibrio razonable entre
 * seguridad y latencia para un POS (login interactivo, no batch).
 */
const BCRYPT_ROUNDS = 10;

/**
 * Tiempo de vida del token de sesión. La gestión de la cookie
 * (httpOnly/secure/sameSite) corresponde a la capa de presentación (tarea 17);
 * aquí solo emitimos/verificamos el string del JWT.
 */
const TOKEN_TTL: SignOptions["expiresIn"] = "12h";

/**
 * Forma del payload que persistimos dentro del JWT. Es un subconjunto plano de
 * `SessionUser`; lo reconstruimos al verificar.
 */
interface SessionTokenPayload extends JwtPayload {
  sub: string;
  usuario: string;
  nombre: string;
  roles: Role[];
  puedeCobrar: boolean;
}

/**
 * Implementación del facade `AuthService` (R1).
 *
 * - Hashing de claves con bcrypt (`bcryptjs`, sin dependencias nativas).
 * - Emisión/verificación de sesiones con JWT (`jsonwebtoken`) firmado con
 *   `process.env.JWT_SECRET`.
 *
 * El secreto se resuelve de forma perezosa (en cada operación) para no fallar
 * al importar el módulo en contextos donde el env aún no está cargado.
 */
export class JwtAuthService implements AuthService {
  private resolverSecreto(): string {
    const secreto = process.env.JWT_SECRET;
    if (!secreto) {
      throw new Error(
        "JWT_SECRET no está definido. Configúralo en las variables de entorno.",
      );
    }
    return secreto;
  }

  async hashClave(clave: string): Promise<string> {
    return bcrypt.hash(clave, BCRYPT_ROUNDS);
  }

  async verificarClave(clave: string, hash: string): Promise<boolean> {
    if (!hash) {
      return false;
    }
    return bcrypt.compare(clave, hash);
  }

  async emitirSesion(user: SessionUser): Promise<string> {
    const payload: SessionTokenPayload = {
      sub: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      roles: user.roles,
      puedeCobrar: user.puedeCobrar,
    };

    return jwt.sign(payload, this.resolverSecreto(), { expiresIn: TOKEN_TTL });
  }

  async verificarSesion(token: string): Promise<SessionUser | null> {
    if (!token) {
      return null;
    }

    try {
      const decoded = jwt.verify(token, this.resolverSecreto());

      if (typeof decoded === "string") {
        return null;
      }

      const payload = decoded as SessionTokenPayload;

      if (
        typeof payload.sub !== "string" ||
        typeof payload.usuario !== "string" ||
        typeof payload.nombre !== "string" ||
        !Array.isArray(payload.roles) ||
        typeof payload.puedeCobrar !== "boolean"
      ) {
        return null;
      }

      return {
        id: payload.sub,
        usuario: payload.usuario,
        nombre: payload.nombre,
        roles: payload.roles,
        puedeCobrar: payload.puedeCobrar,
      };
    } catch {
      // Token inválido, malformado o expirado.
      return null;
    }
  }
}
