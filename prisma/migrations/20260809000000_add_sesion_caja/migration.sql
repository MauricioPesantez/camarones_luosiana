-- Una caja financiera por fecha local de Ecuador. El cierre conserva una foto
-- del esperado y del efectivo contado: cambios historicos posteriores no
-- reescriben la diferencia que el administrador vio al cerrar.
CREATE TABLE "SesionCaja" (
    "id" TEXT NOT NULL,
    "fecha" VARCHAR(10) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'abierta',
    "montoInicial" DECIMAL(10,2) NOT NULL,
    "abiertaPorId" TEXT NOT NULL,
    "abiertaPorNombre" TEXT NOT NULL,
    "abiertaPorRol" TEXT NOT NULL,
    "abiertaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoEsperadoCierre" DECIMAL(10,2),
    "montoCierre" DECIMAL(10,2),
    "diferenciaCierre" DECIMAL(10,2),
    "cerradaPorId" TEXT,
    "cerradaPorNombre" TEXT,
    "cerradaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SesionCaja_pkey" PRIMARY KEY ("id")
);

-- Evita dos aperturas concurrentes para el mismo dia.
CREATE UNIQUE INDEX "SesionCaja_fecha_key" ON "SesionCaja"("fecha");
CREATE INDEX "SesionCaja_estado_idx" ON "SesionCaja"("estado");
CREATE INDEX "SesionCaja_abiertaPorId_idx" ON "SesionCaja"("abiertaPorId");

ALTER TABLE "SesionCaja"
ADD CONSTRAINT "SesionCaja_abiertaPorId_fkey"
FOREIGN KEY ("abiertaPorId") REFERENCES "Usuario"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SesionCaja"
ADD CONSTRAINT "SesionCaja_cerradaPorId_fkey"
FOREIGN KEY ("cerradaPorId") REFERENCES "Usuario"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
