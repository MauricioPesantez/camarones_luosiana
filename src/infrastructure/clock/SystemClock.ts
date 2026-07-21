import type { Clock } from "@/application/ports/Clock";

/**
 * Implementación del facade `Clock` basada en el reloj del sistema.
 *
 * En tests se puede inyectar un reloj determinista que implemente el mismo
 * puerto, en lugar de depender de `new Date()`.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
