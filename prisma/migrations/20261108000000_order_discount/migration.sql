-- AlterTable
ALTER TABLE "Orden" ADD COLUMN     "descuentoTipo" TEXT,
ADD COLUMN     "descuentoValor" DECIMAL(10,2),
ADD COLUMN     "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "descuentoPor" TEXT;
