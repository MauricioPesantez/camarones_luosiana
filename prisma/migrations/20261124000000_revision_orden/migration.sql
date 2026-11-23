-- Bitacora del admin sobre cada orden: solo agrega, no toca ninguna tabla existente.
CREATE TABLE "RevisionOrden" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "detalle" JSONB NOT NULL,
    "revisada" BOOLEAN NOT NULL DEFAULT false,
    "conErrores" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revisadaPorId" TEXT,
    "revisadaPorNombre" TEXT,
    "revisadaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionOrden_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevisionOrden_ordenId_key" ON "RevisionOrden"("ordenId");

ALTER TABLE "RevisionOrden"
ADD CONSTRAINT "RevisionOrden_ordenId_fkey"
FOREIGN KEY ("ordenId") REFERENCES "Orden"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
