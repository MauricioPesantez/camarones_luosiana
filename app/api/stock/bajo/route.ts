import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ProductoStockBajo } from '@/types/stock';

export async function GET() {
  try {
    // Obtener todos los productos con su stock
    const productos = await prisma.producto.findMany({
      select: {
        id: true,
        nombre: true,
        categoria: true,
        stock: true,
        stockMinimo: true,
      },
      orderBy: {
        stock: 'asc',
      },
    });

    // Filtrar productos donde stock <= stockMinimo
    const productosFiltrados: ProductoStockBajo[] = productos
      .filter(p => p.stockMinimo !== null && p.stock <= p.stockMinimo)
      .map(p => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        stock: p.stock,
        stockMinimo: p.stockMinimo as number,
      }));

    return NextResponse.json({
      productos: productosFiltrados,
      total: productosFiltrados.length,
    });
  } catch (error) {
    console.error('Error al obtener productos con stock bajo:', error);
    return NextResponse.json(
      { error: 'Error al obtener productos con stock bajo' },
      { status: 500 }
    );
  }
}
