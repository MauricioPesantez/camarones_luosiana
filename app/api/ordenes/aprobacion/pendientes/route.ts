import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { OrdenPendienteAprobacion } from '@/types/orden';
import { ItemSinStock } from '@/types/stock';
import { ORDENES_VIGENTES } from '@/lib/ordenes-anulacion';
import { getAuthenticatedUser } from '@/lib/session';

export async function GET() {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (usuario.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }
    // Obtener todas las órdenes pendientes de aprobación por stock.
    // Una orden anulada ya no espera decisión de nadie.
    const ordenes = await prisma.orden.findMany({
      where: {
        ...ORDENES_VIGENTES,
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
      numeroDiario: orden.numeroDiario,
      fechaNumeroDiario: orden.fechaNumeroDiario,
      tipoOrden: (orden.tipoOrden ?? 'local') as OrdenPendienteAprobacion['tipoOrden'],
      numeroMesa: orden.numeroMesa,
      nombreCliente: orden.nombreCliente,
      telefonoCliente: orden.telefonoCliente,
      mesero: orden.mesero,
      total: Number(orden.total),
      itemsSinStock: Array.isArray(orden.itemsSinStock)
        ? (orden.itemsSinStock as unknown as ItemSinStock[])
        : [],
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
        nivelPicante: item.nivelPicante as OrdenPendienteAprobacion['items'][number]['nivelPicante'],
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
