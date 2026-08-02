-- Sesiones verificables por servidor para compartir autenticacion entre pestanas.
CREATE TABLE "SesionUsuario" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SesionUsuario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SesionUsuario_tokenHash_key" ON "SesionUsuario"("tokenHash");
CREATE INDEX "SesionUsuario_usuarioId_idx" ON "SesionUsuario"("usuarioId");
CREATE INDEX "SesionUsuario_expiresAt_idx" ON "SesionUsuario"("expiresAt");

ALTER TABLE "SesionUsuario"
ADD CONSTRAINT "SesionUsuario_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Orden"
ADD COLUMN "cobradaPorId" TEXT,
ADD COLUMN "origenCobro" TEXT,
ADD COLUMN "cobroTokenHash" TEXT,
ADD COLUMN "cobroUrl" TEXT,
ADD COLUMN "comprobanteTransferenciaKey" TEXT,
ADD COLUMN "transferenciaConfirmadaAlCrear" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Orden_cobroTokenHash_key" ON "Orden"("cobroTokenHash");
CREATE UNIQUE INDEX "Orden_cobroUrl_key" ON "Orden"("cobroUrl");
CREATE INDEX "Orden_cobradaPorId_idx" ON "Orden"("cobradaPorId");

ALTER TABLE "Orden"
ADD CONSTRAINT "Orden_cobradaPorId_fkey"
FOREIGN KEY ("cobradaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Cobro" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'CONFIRMADO',
    "montoTotal" DECIMAL(10,2) NOT NULL,
    "costoEnvio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "efectivoRecibido" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "efectivoEntregado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transferenciaRecibida" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cobradoPorId" TEXT,
    "cobradoPorNombre" TEXT NOT NULL,
    "cobradoPorRol" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "comprobanteTransferenciaKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cobro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cobro_ordenId_key" ON "Cobro"("ordenId");
CREATE UNIQUE INDEX "Cobro_idempotencyKey_key" ON "Cobro"("idempotencyKey");
CREATE INDEX "Cobro_createdAt_idx" ON "Cobro"("createdAt");
CREATE INDEX "Cobro_cobradoPorId_createdAt_idx" ON "Cobro"("cobradoPorId", "createdAt");

ALTER TABLE "Cobro"
ADD CONSTRAINT "Cobro_ordenId_fkey"
FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Cobro"
ADD CONSTRAINT "Cobro_cobradoPorId_fkey"
FOREIGN KEY ("cobradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
