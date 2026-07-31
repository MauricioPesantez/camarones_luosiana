-- Baseline completo generado desde prisma/schema.prisma.
-- Sustituye el historial parcial usado durante preproduccion.

CREATE TYPE "PrintJobType" AS ENUM ('ORDER', 'AMENDMENT', 'REPRINT');
CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'RETRY', 'SUCCEEDED', 'NEEDS_REVIEW', 'DISCARDED', 'FAILED');

CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,
    "tiempoPreparacion" INTEGER DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Orden" (
    "id" TEXT NOT NULL,
    "tipoOrden" TEXT NOT NULL DEFAULT 'local',
    "numeroMesa" INTEGER,
    "nombreCliente" TEXT,
    "telefonoCliente" TEXT,
    "recargo" DECIMAL(10,2),
    "costoEnvio" DECIMAL(10,2),
    "metodoPago" TEXT,
    "cobrada" BOOLEAN NOT NULL DEFAULT false,
    "fechaCobro" TIMESTAMP(3),
    "cobradaPor" TEXT,
    "mesero" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tiempoEstimado" INTEGER DEFAULT 0,
    "modificada" BOOLEAN NOT NULL DEFAULT false,
    "sinStock" BOOLEAN NOT NULL DEFAULT false,
    "aprobadaPorId" TEXT,
    "razonAprobacion" TEXT,
    "itemsSinStock" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "impresa" BOOLEAN NOT NULL DEFAULT false,
    "printRevision" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Orden_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "type" "PrintJobType" NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 10,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoPrintUntil" TIMESTAMP(3) NOT NULL,
    "workerId" TEXT,
    "leasedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastError" TEXT,
    "printedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrintAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastPrinterCheckAt" TIMESTAMP(3),
    "printerReachable" BOOLEAN,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrintAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "observaciones" TEXT,
    "esCortesia" BOOLEAN NOT NULL DEFAULT false,
    "adminCortesia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Mesa" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "password" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HistorialOrden" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "tipoAccion" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "itemAfectado" JSONB,
    "datosAntes" JSONB,
    "datosDespues" JSONB,
    "usuarioNombre" TEXT NOT NULL,
    "usuarioRol" TEXT NOT NULL,
    "razon" TEXT,
    "diferenciaTotal" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistorialOrden_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrintJob_dedupeKey_key" ON "PrintJob"("dedupeKey");
CREATE INDEX "PrintJob_status_availableAt_idx" ON "PrintJob"("status", "availableAt");
CREATE INDEX "PrintJob_ordenId_createdAt_idx" ON "PrintJob"("ordenId", "createdAt");
CREATE INDEX "PrintJob_leaseExpiresAt_idx" ON "PrintJob"("leaseExpiresAt");
CREATE INDEX "PrintAgent_lastSeenAt_idx" ON "PrintAgent"("lastSeenAt");
CREATE UNIQUE INDEX "Mesa_numero_key" ON "Mesa"("numero");
CREATE INDEX "HistorialOrden_ordenId_idx" ON "HistorialOrden"("ordenId");
CREATE INDEX "HistorialOrden_createdAt_idx" ON "HistorialOrden"("createdAt");

ALTER TABLE "Orden" ADD CONSTRAINT "Orden_aprobadaPorId_fkey" FOREIGN KEY ("aprobadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistorialOrden" ADD CONSTRAINT "HistorialOrden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE CASCADE ON UPDATE CASCADE;
