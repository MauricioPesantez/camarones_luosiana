import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AprobarOrdenRequest } from '@/types/orden';

export async function POST(request: NextRequest) {
  try {
    const body: AprobarOrdenRequest = await request.json();
    const { ordenId, adminId, razon } = body;

    if (!ordenId || !adminId) {
      return NextResponse.json(
        { error: 'Se requieren ordenId y adminId' },
        { status: 400 }
      );
    }

    // Verificar que la orden existe y está pendiente de aprobación
    const orden = await prisma.orden.findUnique({
      where: { id: ordenId },
      include: {
        items: {
          include: {
            producto: true,
          },
        },
      },
    });

    if (!orden) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    if (orden.estado !== 'pendiente_aprobacion_stock') {
      return NextResponse.json(
        { error: 'La orden no está pendiente de aprobación por stock' },
        { status: 400 }
      );
    }

    // Verificar que el admin existe y es admin
    const admin = await prisma.usuario.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      return NextResponse.json(
        { error: 'Administrador no encontrado' },
        { status: 404 }
      );
    }

    if (admin.rol !== 'admin') {
      return NextResponse.json(
        { error: 'Solo los administradores pueden aprobar órdenes' },
        { status: 403 }
      );
    }

    // Descontar el stock de los productos
    // Usamos una transacción para asegurar atomicidad
    const ordenAprobada = await prisma.$transaction(async (tx) => {
      // Descontar stock de cada item
      for (const item of orden.items) {
        const nuevoStock = item.producto.stock - item.cantidad;

        await tx.producto.update({
          where: { id: item.productoId },
          data: { stock: nuevoStock },
        });
      }

      // Actualizar la orden
      const ordenActualizada = await tx.orden.update({
        where: { id: ordenId },
        data: {
          estado: 'pendiente',
          sinStock: true,
          aprobadaPorId: adminId,
          razonAprobacion: razon || 'Aprobada por administrador',
        },
      });

      // Registrar en el historial
      await tx.historialOrden.create({
        data: {
          ordenId: ordenId,
          tipoAccion: 'orden_aprobada_sin_stock',
          descripcion: `Orden aprobada sin stock suficiente por ${admin.nombre}`,
          datosAntes: { estado: 'pendiente_aprobacion_stock' },
          datosDespues: { estado: 'pendiente', aprobadaPor: admin.nombre },
          usuarioNombre: admin.nombre,
          usuarioRol: admin.rol,
          razon: razon || 'Aprobada por administrador',
        },
      });

      return ordenActualizada;
    });

    return NextResponse.json({
      success: true,
      orden: {
        id: ordenAprobada.id,
        estado: ordenAprobada.estado,
        aprobadaPorId: ordenAprobada.aprobadaPorId,
        razonAprobacion: ordenAprobada.razonAprobacion,
      },
      mensaje: 'Orden aprobada exitosamente',
    });
  } catch (error) {
    console.error('Error al aprobar orden:', error);
    return NextResponse.json(
      { error: 'Error al aprobar orden' },
      { status: 500 }
    );
  }
}
