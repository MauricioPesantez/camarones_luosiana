BEGIN;

-- AlterEnum
ALTER TYPE "PrintJobType" ADD VALUE 'EMPLOYEE_RECEIPT';

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "precioEmpleado" DECIMAL(10,2),
ADD COLUMN     "requierePreparacionEmpleado" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Orden" ADD COLUMN     "consumoRequestHash" TEXT,
ADD COLUMN     "consumoRequestId" TEXT,
ADD COLUMN     "empleadoId" TEXT,
ADD COLUMN     "empleadoNombre" TEXT,
ADD COLUMN     "stockRestituido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipoOperacion" TEXT NOT NULL DEFAULT 'VENTA_CLIENTE';

-- AlterTable
ALTER TABLE "PrintJob" ADD COLUMN     "liquidacionId" TEXT;

-- Ampliar el origen exclusivo existente para comprobantes de liquidaciones.
ALTER TABLE "PrintJob" DROP CONSTRAINT "PrintJob_origen_check";
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_origen_check"
CHECK (
  ("ordenId" IS NOT NULL AND "retiroId" IS NULL
    AND "liquidacionId" IS NULL AND "type"::text <> 'CASH_WITHDRAWAL')
  OR
  ("ordenId" IS NULL AND "retiroId" IS NOT NULL
    AND "liquidacionId" IS NULL AND "type"::text = 'CASH_WITHDRAWAL')
  OR
  ("ordenId" IS NULL AND "retiroId" IS NULL
    AND "liquidacionId" IS NOT NULL AND "type"::text = 'EMPLOYEE_RECEIPT')
);

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "nombreProducto" TEXT,
ADD COLUMN     "precioCarta" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "aperturaCuenta" JSONB,
ADD COLUMN     "cuentaActivadaAt" TIMESTAMP(3),
ADD COLUMN     "cuentaRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MovimientoCuentaEmpleado" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "empleadoNombre" TEXT NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "autorRol" TEXT NOT NULL,
    "origenClave" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT,
    "retiroId" TEXT,
    "ordenId" TEXT,
    "liquidacionId" TEXT,
    "movimientoOrigenId" TEXT,
    "detalle" JSONB,
    "fechaHecho" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCuentaEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionEmpleado" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "empleadoNombre" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "autorRol" TEXT NOT NULL,
    "fechaDescuento" TIMESTAMP(3) NOT NULL,
    "saldoAnterior" DECIMAL(10,2) NOT NULL,
    "montoAplicado" DECIMAL(10,2) NOT NULL,
    "saldoPosterior" DECIMAL(10,2) NOT NULL,
    "corteSecuencia" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidacionEmpleado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoCuentaEmpleado_origenClave_key" ON "MovimientoCuentaEmpleado"("origenClave");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoCuentaEmpleado_idempotencyKey_key" ON "MovimientoCuentaEmpleado"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MovimientoCuentaEmpleado_empleadoId_createdAt_idx" ON "MovimientoCuentaEmpleado"("empleadoId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimientoCuentaEmpleado_retiroId_idx" ON "MovimientoCuentaEmpleado"("retiroId");

-- CreateIndex
CREATE INDEX "MovimientoCuentaEmpleado_ordenId_idx" ON "MovimientoCuentaEmpleado"("ordenId");

-- CreateIndex
CREATE INDEX "MovimientoCuentaEmpleado_liquidacionId_idx" ON "MovimientoCuentaEmpleado"("liquidacionId");

-- CreateIndex
CREATE INDEX "MovimientoCuentaEmpleado_movimientoOrigenId_idx" ON "MovimientoCuentaEmpleado"("movimientoOrigenId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoCuentaEmpleado_empleadoId_secuencia_key" ON "MovimientoCuentaEmpleado"("empleadoId", "secuencia");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidacionEmpleado_idempotencyKey_key" ON "LiquidacionEmpleado"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LiquidacionEmpleado_empleadoId_createdAt_idx" ON "LiquidacionEmpleado"("empleadoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Orden_consumoRequestId_key" ON "Orden"("consumoRequestId");

-- CreateIndex
CREATE INDEX "Orden_tipoOperacion_empleadoId_createdAt_idx" ON "Orden"("tipoOperacion", "empleadoId", "createdAt");

-- CreateIndex
CREATE INDEX "PrintJob_liquidacionId_createdAt_idx" ON "PrintJob"("liquidacionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "LiquidacionEmpleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaEmpleado" ADD CONSTRAINT "MovimientoCuentaEmpleado_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaEmpleado" ADD CONSTRAINT "MovimientoCuentaEmpleado_retiroId_fkey" FOREIGN KEY ("retiroId") REFERENCES "RetiroCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaEmpleado" ADD CONSTRAINT "MovimientoCuentaEmpleado_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaEmpleado" ADD CONSTRAINT "MovimientoCuentaEmpleado_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "LiquidacionEmpleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaEmpleado" ADD CONSTRAINT "MovimientoCuentaEmpleado_movimientoOrigenId_fkey" FOREIGN KEY ("movimientoOrigenId") REFERENCES "MovimientoCuentaEmpleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionEmpleado" ADD CONSTRAINT "LiquidacionEmpleado_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business invariants for all writes, including concurrent requests.
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_precioEmpleado_check"
  CHECK ("precioEmpleado" IS NULL OR ("precioEmpleado" > 0 AND "precioEmpleado" <= "precio"));
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_tipoOperacion_check"
  CHECK ("tipoOperacion" IN ('VENTA_CLIENTE', 'CONSUMO_EMPLEADO'));
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_consumoEmpleado_check"
  CHECK ("tipoOperacion" <> 'CONSUMO_EMPLEADO' OR
    ("empleadoId" IS NOT NULL AND "empleadoNombre" IS NOT NULL AND "consumoRequestId" IS NOT NULL
     AND "tipoOrden" IN ('local', 'para_llevar') AND "cobroUrl" IS NULL AND "cobroTokenHash" IS NULL
     AND "montoPagado" = 0 AND NOT "cobrada"));
ALTER TABLE "MovimientoCuentaEmpleado" ADD CONSTRAINT "MovimientoCuentaEmpleado_monto_check" CHECK ("monto" <> 0);
ALTER TABLE "LiquidacionEmpleado" ADD CONSTRAINT "LiquidacionEmpleado_importes_check"
  CHECK ("montoAplicado" > 0 AND "montoAplicado" <= "saldoAnterior"
    AND "saldoPosterior" = "saldoAnterior" - "montoAplicado");

ALTER TABLE "MovimientoCuentaEmpleado" ADD CONSTRAINT "MovimientoCuentaEmpleado_tipo_signo_check"
  CHECK (("tipo" IN ('APERTURA', 'ADELANTO', 'CONSUMO', 'REVERSO_LIQUIDACION') AND "monto" > 0)
      OR ("tipo" IN ('DESCUENTO_SUELDO', 'REVERSO_ADELANTO', 'REVERSO_CONSUMO') AND "monto" < 0));
ALTER TABLE "MovimientoCuentaEmpleado" ADD CONSTRAINT "MovimientoCuentaEmpleado_secuencia_check" CHECK ("secuencia" > 0);

COMMIT;
