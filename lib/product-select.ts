import type { Prisma } from '@prisma/client';

/** Public catalog fields also used inside operational order responses. */
export const PUBLIC_PRODUCT_SELECT = {
  id: true, nombre: true, categoria: true, precio: true, disponible: true,
  descripcion: true, tiempoPreparacion: true, stock: true, stockMinimo: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.ProductoSelect;
