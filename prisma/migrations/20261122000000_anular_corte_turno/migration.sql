-- El admin anula el ultimo corte; la fila se conserva.
ALTER TABLE "CorteTurno"
ADD COLUMN "anuladoPorNombre" TEXT,
ADD COLUMN "razonAnulacion" TEXT,
ADD COLUMN "anuladoAt" TIMESTAMP(3);
