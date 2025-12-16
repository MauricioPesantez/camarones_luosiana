import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RechazarOrdenRequest } from '@/types/orden';

export async function POST(request: NextRequest) {
  try {
    const body: RechazarOrdenRequest = await request.json();
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
        { error: 'Solo los administradores pueden rechazar órdenes' },
        { status: 403 }
      );
    }

    // Cambiar el estado de la orden a cancelada
    const ordenRechazada = await prisma.$transaction(async (tx) => {
      const ordenActualizada = await tx.orden.update({
        where: { id: ordenId },
        data: {
          estado: 'cancelada',
        },
      });

      // Registrar en el historial
      await tx.historialOrden.create({
        data: {
          ordenId: ordenId,
          tipoAccion: 'orden_rechazada_sin_stock',
          descripcion: `Orden rechazada por falta de stock por ${admin.nombre}`,
          datosAntes: { estado: 'pendiente_aprobacion_stock' },
          datosDespues: { estado: 'cancelada' },
          usuarioNombre: admin.nombre,
          usuarioRol: admin.rol,
          razon: razon || 'Rechazada por falta de stock',
        },
      });

      return ordenActualizada;
    });

    return NextResponse.json({
      success: true,
      orden: {
        id: ordenRechazada.id,
        estado: ordenRechazada.estado,
      },
      mensaje: 'Orden rechazada exitosamente',
    });
  } catch (error) {
    console.error('Error al rechazar orden:', error);
    return NextResponse.json(
      { error: 'Error al rechazar orden' },
      { status: 500 }
    );
  }
}
