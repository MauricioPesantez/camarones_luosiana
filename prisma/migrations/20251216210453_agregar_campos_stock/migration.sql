-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,
    "tiempoPreparacion" INTEGER DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orden" (
    "id" TEXT NOT NULL,
    "numeroMesa" INTEGER NOT NULL,
    "mesero" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "observaciones" TEXT,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tiempoEstimado" INTEGER DEFAULT 0,
    "modificada" BOOLEAN NOT NULL DEFAULT false,
    "sinStock" BOOLEAN NOT NULL DEFAULT false,
    "aprobadaPorId" TEXT,
    "razonAprobacion" TEXT,
    "itemsSinStock" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "impresa" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mesa" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "password" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialOrden" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "tipoAccion" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "itemAfectado" JSONB,
    "datosAntes" JSONB,
    "datosDespues" JSONB,
    "usuarioNombre" TEXT NOT NULL,
    "usuarioRol" TEXT NOT NULL,
    "razon" TEXT,
    "diferenciaTotal" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialOrden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_numero_key" ON "Mesa"("numero");

-- CreateIndex
CREATE INDEX "HistorialOrden_ordenId_idx" ON "HistorialOrden"("ordenId");

-- CreateIndex
CREATE INDEX "HistorialOrden_createdAt_idx" ON "HistorialOrden"("createdAt");

-- AddForeignKey
ALTER TABLE "Orden" ADD CONSTRAINT "Orden_aprobadaPorId_fkey" FOREIGN KEY ("aprobadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialOrden" ADD CONSTRAINT "HistorialOrden_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") ON DELETE CASCADE ON UPDATE CASCADE;
