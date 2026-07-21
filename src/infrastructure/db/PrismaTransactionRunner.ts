import type { PrismaClient } from "@prisma/client";

import type {
  TransactionRunner,
  TransactionalRepositories,
} from "@/application/ports/TransactionRunner";

import { prisma } from "./prisma";
import { runInTransaction } from "./unitOfWork";

/**
 * Implementación del puerto `TransactionRunner` sobre Prisma.
 *
 * Delega en `runInTransaction` (tarea 9), que abre una transacción Prisma y
 * construye un conjunto de repositorios atados al cliente transaccional. Los
 * repositorios Prisma implementan estructuralmente los puertos, por lo que el
 * `UnitOfWork` resultante satisface `TransactionalRepositories`.
 */
export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly client: PrismaClient = prisma) {}

  run<T>(
    fn: (repos: TransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return runInTransaction(fn, this.client);
  }
}
