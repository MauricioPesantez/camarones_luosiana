import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ValidacionStock, ItemSinStock } from '@/types/stock';

interface ItemValidacion {
  productoId: string;
  cantidad: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: { items: ItemValidacion[] } = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de items con productoId y cantidad' },
        { status: 400 }
      );
    }

    // Validar que todos los items tengan los campos requeridos
    for (const item of items) {
      if (!item.productoId || item.cantidad === undefined || item.cantidad <= 0) {
        return NextResponse.json(
          { error: 'Cada item debe tener productoId y cantidad válida' },
          { status: 400 }
        );
      }
    }

    // Obtener todos los productos con sus stocks
    const productoIds = items.map(item => item.productoId);
    const productos = await prisma.producto.findMany({
      where: {
        id: { in: productoIds },
      },
      select: {
        id: true,
        nombre: true,
        stock: true,
      },
    });

    // Crear un mapa de productos por ID para acceso rápido
    const productosMap = new Map(
      productos.map(p => [p.id, p])
    );

    // Validar stock para cada item
    const itemsSinStock: ItemSinStock[] = [];

    for (const item of items) {
      const producto = productosMap.get(item.productoId);

      if (!producto) {
        // Producto no encontrado
        itemsSinStock.push({
          productoId: item.productoId,
          productoNombre: 'Producto no encontrado',
          cantidadSolicitada: item.cantidad,
          stockDisponible: 0,
        });
        continue;
      }

      // Verificar si hay suficiente stock
      if (producto.stock < item.cantidad) {
        itemsSinStock.push({
          productoId: producto.id,
          productoNombre: producto.nombre,
          cantidadSolicitada: item.cantidad,
          stockDisponible: producto.stock,
        });
      }
    }

    const hayStock = itemsSinStock.length === 0;

    const respuesta: ValidacionStock = {
      hayStock,
      itemsSinStock,
      mensaje: hayStock
        ? 'Todos los productos tienen stock suficiente'
        : `${itemsSinStock.length} producto(s) sin stock suficiente`,
    };

    return NextResponse.json(respuesta);
  } catch (error) {
    console.error('Error al validar stock:', error);
    return NextResponse.json(
      { error: 'Error al validar stock' },
      { status: 500 }
    );
  }
}
