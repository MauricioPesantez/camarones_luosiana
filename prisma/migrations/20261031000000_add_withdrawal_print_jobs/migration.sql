-- Un comprobante de retiro pertenece a un retiro real, nunca a una orden ficticia.
ALTER TYPE "PrintJobType" ADD VALUE 'CASH_WITHDRAWAL';
ALTER TABLE "PrintJob" ALTER COLUMN "ordenId" DROP NOT NULL;
ALTER TABLE "PrintJob" ADD COLUMN "retiroId" TEXT;
CREATE INDEX "PrintJob_retiroId_createdAt_idx" ON "PrintJob"("retiroId", "createdAt");
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_retiroId_fkey"
FOREIGN KEY ("retiroId") REFERENCES "RetiroCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Exactamente un origen; los trabajos historicos ya tienen ordenId.
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_origen_check"
CHECK (("ordenId" IS NOT NULL AND "retiroId" IS NULL AND "type"::text <> 'CASH_WITHDRAWAL')
    OR ("ordenId" IS NULL AND "retiroId" IS NOT NULL AND "type"::text = 'CASH_WITHDRAWAL'));
