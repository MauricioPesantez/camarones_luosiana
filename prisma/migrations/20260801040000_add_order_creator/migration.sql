-- El creador y su rol se guardan por separado del nombre legado `mesero`.
ALTER TABLE "Orden"
ADD COLUMN "creadorId" TEXT,
ADD COLUMN "creadorRol" TEXT;

-- Recupera la autoria historica cuando el nombre coincide con un usuario.
UPDATE "Orden" AS orden
SET
  "creadorId" = usuario."id",
  "creadorRol" = usuario."rol"
FROM "Usuario" AS usuario
WHERE lower(trim(orden."mesero")) = lower(trim(usuario."nombre"));

CREATE INDEX "Orden_creadorId_idx" ON "Orden"("creadorId");

ALTER TABLE "Orden"
ADD CONSTRAINT "Orden_creadorId_fkey"
FOREIGN KEY ("creadorId") REFERENCES "Usuario"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
