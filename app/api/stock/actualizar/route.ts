import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { ActualizarStockRequest } from '@/types/stock';

export async function POST(request: NextRequest) {
  try {
    const body: ActualizarStockRequest = await request.json();
    const { productoId, cantidad, operacion } = body;

    if (!productoId || cantidad === undefined || !operacion) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: productoId, cantidad, operacion' },
        { status: 400 }
      );
    }

    if (!['agregar', 'establecer'].includes(operacion)) {
      return NextResponse.json(
        { error: 'Operación debe ser "agregar" o "establecer"' },
        { status: 400 }
      );
    }

    // Obtener el producto actual
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    });

    if (!producto) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Calcular el nuevo stock
    let nuevoStock: number;
    if (operacion === 'establecer') {
      nuevoStock = cantidad;
    } else {
      // agregar (puede ser positivo o negativo)
      nuevoStock = producto.stock + cantidad;
    }

    // Validar que el stock no sea negativo
    if (nuevoStock < 0) {
      return NextResponse.json(
        {
          error: 'El stock no puede ser negativo',
          stockActual: producto.stock,
          cantidadSolicitada: cantidad
        },
        { status: 400 }
      );
    }

    // Actualizar el stock
    const productoActualizado = await prisma.producto.update({
      where: { id: productoId },
      data: { stock: nuevoStock },
    });

    return NextResponse.json({
      success: true,
      producto: {
        id: productoActualizado.id,
        nombre: productoActualizado.nombre,
        stockAnterior: producto.stock,
        stockNuevo: productoActualizado.stock,
        diferencia: productoActualizado.stock - producto.stock,
      },
    });
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    return NextResponse.json(
      { error: 'Error al actualizar stock' },
      { status: 500 }
    );
  }
}
