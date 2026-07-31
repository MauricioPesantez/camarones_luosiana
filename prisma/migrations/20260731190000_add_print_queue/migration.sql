-- CreateEnum
CREATE TYPE "PrintJobType" AS ENUM ('ORDER', 'AMENDMENT', 'REPRINT');

-- CreateEnum
CREATE TYPE "PrintJobStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'RETRY',
    'SUCCEEDED',
    'NEEDS_REVIEW',
    'DISCARDED',
    'FAILED'
);

-- AlterTable
ALTER TABLE "Orden"
ADD COLUMN "printRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "PrintJob_dedupeKey_key" ON "PrintJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "PrintJob_status_availableAt_idx" ON "PrintJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "PrintJob_ordenId_createdAt_idx" ON "PrintJob"("ordenId", "createdAt");

-- CreateIndex
CREATE INDEX "PrintJob_leaseExpiresAt_idx" ON "PrintJob"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "PrintAgent_lastSeenAt_idx" ON "PrintAgent"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "PrintJob"
ADD CONSTRAINT "PrintJob_ordenId_fkey"
FOREIGN KEY ("ordenId") REFERENCES "Orden"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
