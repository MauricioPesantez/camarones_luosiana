-- Cobro pasa de "el cobro de la orden" a "un pago". Una orden puede tener varios.
DROP INDEX "Cobro_ordenId_key";
CREATE INDEX "Cobro_ordenId_idx" ON "Cobro"("ordenId");

-- Importe de cada pago. Las filas existentes son una por orden, asi que el
-- importe del pago es el total de la orden.
ALTER TABLE "Cobro" ADD COLUMN "monto" DECIMAL(10,2);
UPDATE "Cobro" SET "monto" = "montoTotal";
ALTER TABLE "Cobro" ALTER COLUMN "monto" SET NOT NULL;

-- El envio deja de vivir en el pago: pasa a calcularse a nivel de orden.
ALTER TABLE "Cobro" DROP COLUMN "efectivoEntregado";

-- Los movimientos del pago pasan a ser brutos. La unica combinacion que
-- guardaba un valor neto era domicilio en efectivo, que restaba el envio.
UPDATE "Cobro" c
SET "efectivoRecibido" = c."montoTotal"
FROM "Orden" o
WHERE o."id" = c."ordenId"
  AND c."metodoPago" = 'efectivo'
  AND o."tipoOrden" = 'domicilio';

-- Saldo materializado en la orden.
ALTER TABLE "Orden" ADD COLUMN "montoPagado" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "Orden" o
SET "montoPagado" = COALESCE(
  (SELECT SUM(c."monto") FROM "Cobro" c
   WHERE c."ordenId" = o."id" AND c."estado" <> 'REEMBOLSADO'),
  0
);

-- Ordenes cobradas antes de que existiera la tabla Cobro: no tienen filas de
-- pago, pero estan pagadas. Sin esto quedarian con saldo pendiente.
UPDATE "Orden"
SET "montoPagado" = "total"
WHERE "cobrada" = true AND "montoPagado" = 0;
