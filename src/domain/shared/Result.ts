import { DomainError } from "./DomainError";

/**
 * Tipo `Result<T, E>`: unión discriminada para representar el resultado de una
 * operación que puede tener éxito (`ok`) o fallar (`err`), sin lanzar
 * excepciones. Lo usan los casos de uso para devolver errores tipados.
 *
 * Por defecto el tipo de error es `DomainError`.
 */
export type Result<T, E = DomainError> = Ok<T, E> | Err<T, E>;

export interface Ok<T, E> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<T, E> {
  readonly ok: false;
  readonly error: E;
}

/** Construye un resultado exitoso. */
export function ok<T, E = DomainError>(value: T): Result<T, E> {
  return { ok: true, value };
}

/** Construye un resultado fallido. */
export function err<T = never, E = DomainError>(error: E): Result<T, E> {
  return { ok: false, error };
}

/** Type guard: indica si el resultado es exitoso (y refina a `Ok`). */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T, E> {
  return result.ok;
}

/** Type guard: indica si el resultado es fallido (y refina a `Err`). */
export function isErr<T, E>(result: Result<T, E>): result is Err<T, E> {
  return !result.ok;
}
