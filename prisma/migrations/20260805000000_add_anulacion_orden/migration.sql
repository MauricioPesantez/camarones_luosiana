-- Anulacion logica de una orden: el equivalente para ventas de lo que
-- `RetiroCaja.estado = 'anulado'` ya hace con las salidas de efectivo.
--
-- Migracion aditiva: solo agrega columnas con default, asi que las ordenes
-- historicas quedan con `anulada = false` y ningun cuadre anterior se mueve.
ALTER TABLE "Orden" ADD COLUMN "anulada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Orden" ADD COLUMN "anuladaPorId" TEXT;
ALTER TABLE "Orden" ADD COLUMN "anuladaPorNombre" TEXT;
ALTER TABLE "Orden" ADD COLUMN "razonAnulacion" TEXT;
ALTER TABLE "Orden" ADD COLUMN "anuladaAt" TIMESTAMP(3);

-- Si se borra al admin que anulo, la anulacion sobrevive: el nombre quedo
-- congelado en `anuladaPorNombre`, igual que en los retiros.
ALTER TABLE "Orden"
ADD CONSTRAINT "Orden_anuladaPorId_fkey"
FOREIGN KEY ("anuladaPorId") REFERENCES "Usuario"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
