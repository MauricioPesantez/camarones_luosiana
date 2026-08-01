-- El cuid se conserva como clave tecnica. Estos campos agregan el numero visible del dia.
ALTER TABLE "Orden"
ADD COLUMN "numeroDiario" INTEGER,
ADD COLUMN "fechaNumeroDiario" VARCHAR(10);

CREATE TABLE "ContadorOrdenDiaria" (
    "fecha" VARCHAR(10) NOT NULL,
    "ultimoNumero" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContadorOrdenDiaria_pkey" PRIMARY KEY ("fecha")
);

CREATE UNIQUE INDEX "Orden_fechaNumeroDiario_numeroDiario_key"
ON "Orden"("fechaNumeroDiario", "numeroDiario");
