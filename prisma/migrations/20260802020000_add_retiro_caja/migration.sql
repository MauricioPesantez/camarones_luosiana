-- Salidas de efectivo de la caja registradas por los empleados.
-- Tabla nueva y aditiva: no toca ninguna columna existente, asi que no puede
-- alterar los cuadres historicos ni la cola de impresion.
CREATE TABLE "RetiroCaja" (
    "id" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "categoria" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "usuarioRol" TEXT NOT NULL,
    "beneficiarioId" TEXT,
    "beneficiarioNombre" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'registrado',
    "anuladoPorId" TEXT,
    "anuladoPorNombre" TEXT,
    "razonAnulacion" TEXT,
    "anuladoAt" TIMESTAMP(3),
    "clientRequestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetiroCaja_pkey" PRIMARY KEY ("id")
);

-- Un reintento del mismo envio no puede convertirse en dos salidas de dinero.
CREATE UNIQUE INDEX "RetiroCaja_clientRequestId_key" ON "RetiroCaja"("clientRequestId");

-- El cuadre pide los retiros de un dia; la pantalla del mesero, los suyos.
CREATE INDEX "RetiroCaja_createdAt_idx" ON "RetiroCaja"("createdAt");
CREATE INDEX "RetiroCaja_usuarioId_createdAt_idx" ON "RetiroCaja"("usuarioId", "createdAt");

ALTER TABLE "RetiroCaja"
ADD CONSTRAINT "RetiroCaja_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Si se borra al beneficiario el retiro sobrevive: el nombre quedo congelado.
ALTER TABLE "RetiroCaja"
ADD CONSTRAINT "RetiroCaja_beneficiarioId_fkey"
FOREIGN KEY ("beneficiarioId") REFERENCES "Usuario"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RetiroCaja"
ADD CONSTRAINT "RetiroCaja_anuladoPorId_fkey"
FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
