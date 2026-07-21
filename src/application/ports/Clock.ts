/**
 * Facade de reloj del sistema.
 *
 * Abstrae la obtención de la hora actual, permitiendo inyectar un reloj
 * determinista en tests (en lugar de depender de `new Date()`).
 */
export interface Clock {
  /** Retorna la fecha/hora actual. */
  now(): Date;
}
