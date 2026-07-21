import { randomUUID } from "node:crypto";

import type { IdGenerator } from "@/application/ports/IdGenerator";

/**
 * Implementación de `IdGenerator` basada en `crypto.randomUUID`.
 *
 * Genera identificadores opacos para entidades creadas por los casos de uso
 * (órdenes, ítems de orden, entradas de auditoría) cuando el agregado necesita
 * un id antes de persistirse.
 */
export class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
