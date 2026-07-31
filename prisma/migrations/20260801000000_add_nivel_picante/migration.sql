-- El valor por defecto mantiene compatibles las órdenes creadas antes de esta migración.
ALTER TABLE "Orden"
ADD COLUMN "nivelPicante" TEXT NOT NULL DEFAULT 'natural';
