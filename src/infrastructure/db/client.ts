import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Tipo de cliente Prisma aceptado por los repositorios.
 *
 * Puede ser el `PrismaClient` singleton (operaciones sueltas) o un
 * `Prisma.TransactionClient` (cuando la operación corre dentro de una unidad
 * de trabajo `runInTransaction`). Gracias a esto un mismo repositorio sirve
 * tanto fuera como dentro de una transacción sin duplicar código.
 */
export type PrismaClientLike = PrismaClient | Prisma.TransactionClient;
