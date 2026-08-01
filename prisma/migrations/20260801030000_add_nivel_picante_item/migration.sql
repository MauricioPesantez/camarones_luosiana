-- El nivel de picante pertenece a cada línea de combo, no a la orden completa.
ALTER TABLE "Item"
ADD COLUMN "nivelPicante" TEXT;

-- Conserva el dato de órdenes existentes en sus items de categoría Combo(s).
UPDATE "Item" AS item
SET "nivelPicante" = orden."nivelPicante"
FROM "Orden" AS orden, "Producto" AS producto
WHERE item."ordenId" = orden.id
  AND item."productoId" = producto.id
  AND LOWER(TRIM(producto.categoria)) IN ('combo', 'combos');
