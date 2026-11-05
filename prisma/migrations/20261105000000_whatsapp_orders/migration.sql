-- AlterTable
ALTER TABLE "Orden" ADD COLUMN     "deliverySolicitadoAt" TIMESTAMP(3),
ADD COLUMN     "referenciaEntrega" TEXT,
ADD COLUMN     "ubicacionUrl" TEXT;

-- CreateTable
CREATE TABLE "WhatsappEntrada" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "claveEntrega" TEXT,
    "remitente" TEXT NOT NULL,
    "usuarioId" TEXT,
    "enviadoAt" TIMESTAMP(3) NOT NULL,
    "recibidaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "texto" TEXT,
    "datosNormalizados" JSONB,
    "requestHash" TEXT,
    "estado" TEXT NOT NULL,
    "ordenId" TEXT,
    "error" TEXT,

    CONSTRAINT "WhatsappEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappSalida" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ordenId" TEXT,
    "entradaId" TEXT,
    "tipo" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "disponibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceAt" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "reservaToken" TEXT,
    "reservaExpiraAt" TIMESTAMP(3),
    "mensajeId" TEXT,
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappSalida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappEntrada_requestHash_recibidaAt_idx" ON "WhatsappEntrada"("requestHash", "recibidaAt");

-- CreateIndex
CREATE INDEX "WhatsappEntrada_remitente_tipo_estado_recibidaAt_idx" ON "WhatsappEntrada"("remitente", "tipo", "estado", "recibidaAt");

-- CreateIndex
CREATE INDEX "WhatsappEntrada_ordenId_idx" ON "WhatsappEntrada"("ordenId");

-- CreateIndex
CREATE INDEX "WhatsappEntrada_usuarioId_idx" ON "WhatsappEntrada"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappEntrada_sessionId_messageId_key" ON "WhatsappEntrada"("sessionId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappSalida_clave_key" ON "WhatsappSalida"("clave");

-- CreateIndex
CREATE INDEX "WhatsappSalida_estado_disponibleAt_idx" ON "WhatsappSalida"("estado", "disponibleAt");

-- CreateIndex
CREATE INDEX "WhatsappSalida_ordenId_idx" ON "WhatsappSalida"("ordenId");

-- CreateIndex
CREATE INDEX "WhatsappSalida_entradaId_idx" ON "WhatsappSalida"("entradaId");

-- AddForeignKey
ALTER TABLE "WhatsappEntrada" ADD CONSTRAINT "WhatsappEntrada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappEntrada" ADD CONSTRAINT "WhatsappEntrada_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappSalida" ADD CONSTRAINT "WhatsappSalida_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappSalida" ADD CONSTRAINT "WhatsappSalida_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "WhatsappEntrada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

