import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RechazarOrdenRequest } from '@/types/orden';
import { getAuthenticatedUser } from '@/lib/session';

class RejectionConflictError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthenticatedUser();
    if (!admin) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (admin.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo los administradores pueden rechazar órdenes' }, { status: 403 });
    }
    const body: RechazarOrdenRequest = await request.json();
    const { ordenId, razon } = body;

    if (!ordenId) {
      return NextResponse.json(
        { error: 'Se requiere ordenId' },
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

    if (orden.anulada) {
      return NextResponse.json(
        { error: 'La orden ya fue anulada' },
        { status: 409 }
      );
    }

    if (orden.estado !== 'pendiente_aprobacion_stock') {
      return NextResponse.json(
        { error: 'La orden no está pendiente de aprobación por stock' },
        { status: 400 }
      );
    }

    // Cambiar el estado de la orden a cancelada
    const ordenRechazada = await prisma.$transaction(async (tx) => {
      const transition = await tx.orden.updateMany({
        where: {
          id: ordenId,
          estado: 'pendiente_aprobacion_stock',
          anulada: false,
        },
        data: {
          estado: 'cancelada',
        },
      });
      if (transition.count !== 1) {
        throw new RejectionConflictError(
          'La orden ya fue aprobada, rechazada o anulada por otra solicitud.',
        );
      }
      const ordenActualizada = await tx.orden.findUniqueOrThrow({
        where: { id: ordenId },
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

      if (ordenActualizada.cobrada) {
        await tx.cobro.updateMany({
          where: { ordenId, estado: 'CONFIRMADO' },
          data: { estado: 'REEMBOLSO_PENDIENTE' },
        });
      }

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
    if (error instanceof RejectionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error al rechazar orden:', error);
    return NextResponse.json(
      { error: 'Error al rechazar orden' },
      { status: 500 }
    );
  }
}
