-- AlterTable
ALTER TABLE "WhatsappEntrada" ADD COLUMN     "revisadaAt" TIMESTAMP(3),
ADD COLUMN     "revisadaPor" TEXT;

-- AlterTable
ALTER TABLE "WhatsappSalida" ADD COLUMN     "revisadaAt" TIMESTAMP(3),
ADD COLUMN     "revisadaPor" TEXT;
