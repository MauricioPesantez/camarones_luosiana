-- Modalidad de pago acordada al crear la orden. Solo aplica a "domicilio":
-- "efectivo"      -> el local cobra al motorizado (total - costoEnvio) cuando retira el pedido.
-- "transferencia" -> el cliente deposita el total y el local entrega el costoEnvio al motorizado.
-- Las ordenes existentes quedan en NULL y conservan el comportamiento anterior.
ALTER TABLE "Orden"
ADD COLUMN "metodoPagoPrevisto" TEXT;
