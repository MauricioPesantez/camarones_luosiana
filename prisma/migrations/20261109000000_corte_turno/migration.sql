-- Relevo de turno sobre la caja compartida del dia.
CREATE TABLE "CorteTurno" (
    "id" TEXT NOT NULL,
    "sesionCajaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fondoInicial" DECIMAL(10,2) NOT NULL,
    "esperadoDia" DECIMAL(10,2) NOT NULL,
    "montoEsperado" DECIMAL(10,2) NOT NULL,
    "montoContado" DECIMAL(10,2) NOT NULL,
    "diferencia" DECIMAL(10,2) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "usuarioRol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorteTurno_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CorteTurno_sesionCajaId_numero_key" ON "CorteTurno"("sesionCajaId", "numero");
CREATE INDEX "CorteTurno_usuarioId_idx" ON "CorteTurno"("usuarioId");

ALTER TABLE "CorteTurno"
ADD CONSTRAINT "CorteTurno_sesionCajaId_fkey"
FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CorteTurno"
ADD CONSTRAINT "CorteTurno_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
