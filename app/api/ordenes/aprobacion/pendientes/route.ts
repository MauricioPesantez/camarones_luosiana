import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { OrdenPendienteAprobacion } from '@/types/orden';
import { ItemSinStock } from '@/types/stock';

export async function GET() {
  try {
    // Obtener todas las órdenes pendientes de aprobación por stock
    const ordenes = await prisma.orden.findMany({
      where: {
        estado: 'pendiente_aprobacion_stock',
      },
      include: {
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                categoria: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Más antiguas primero
      },
    });

    const ordenesPendientes: OrdenPendienteAprobacion[] = ordenes.map(orden => ({
      id: orden.id,
      numeroMesa: orden.numeroMesa,
      mesero: orden.mesero,
      total: Number(orden.total),
      itemsSinStock: (orden.itemsSinStock as ItemSinStock[]) || [],
      createdAt: orden.createdAt,
      items: orden.items.map(item => ({
        id: item.id,
        cantidad: item.cantidad,
        producto: {
          id: item.producto.id,
          nombre: item.producto.nombre,
          categoria: item.producto.categoria,
        },
        precioUnitario: Number(item.precioUnitario),
        subtotal: Number(item.subtotal),
        observaciones: item.observaciones,
      })),
    }));

    return NextResponse.json({
      ordenes: ordenesPendientes,
      total: ordenesPendientes.length,
    });
  } catch (error) {
    console.error('Error al obtener órdenes pendientes:', error);
    return NextResponse.json(
      { error: 'Error al obtener órdenes pendientes de aprobación' },
      { status: 500 }
    );
  }
}
