import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma como singleton.
 *
 * En entornos serverless (p. ej. Amplify Hosting / Lambda) y en desarrollo con
 * hot-reload, instanciar un `PrismaClient` por invocación agota el pool de
 * conexiones. Cacheamos la instancia en `globalThis` para reutilizarla entre
 * recargas y ejecuciones.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
