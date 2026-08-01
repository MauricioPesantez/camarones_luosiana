import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const cachedPrisma = globalForPrisma.prisma;
const compatiblePrisma = cachedPrisma?.contadorOrdenDiaria
  ? cachedPrisma
  : undefined;

// Next.js conserva globalThis entre recargas en desarrollo. Si el esquema cambio
// mientras el servidor estaba activo, descartar el cliente generado anteriormente.
if (cachedPrisma && !compatiblePrisma) {
  void cachedPrisma.$disconnect();
}

export const prisma = compatiblePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
