import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AprobarOrdenRequest } from '@/types/orden';
import {
  PRINT_JOB_TYPES,
  enqueueOrderPrintJob,
  shouldEnqueuePrintJob,
} from '@/lib/print-jobs';

class ApprovalConflictError extends Error {}

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
    const { ordenAprobada, printJobQueued } = await prisma.$transaction(async (tx) => {
      const transicion = await tx.orden.updateMany({
        where: {
          id: ordenId,
          estado: 'pendiente_aprobacion_stock',
        },
        data: {
          estado: 'pendiente',
          sinStock: true,
          aprobadaPorId: adminId,
          razonAprobacion: razon || 'Aprobada por administrador',
        },
      });

      if (transicion.count !== 1) {
        throw new ApprovalConflictError(
          'La orden ya fue procesada por otra solicitud.',
        );
      }

      // Descontar stock de cada item
      for (const item of orden.items) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: { stock: { decrement: item.cantidad } },
        });
      }

      const ordenActualizada = await tx.orden.findUniqueOrThrow({
        where: { id: ordenId },
        include: {
          items: {
            include: {
              producto: true,
            },
          },
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

      let queued = false;
      if (shouldEnqueuePrintJob(ordenActualizada.createdAt)) {
        await enqueueOrderPrintJob(tx, ordenActualizada, {
          type: PRINT_JOB_TYPES.ORDER,
          revision: ordenActualizada.printRevision,
        });
        queued = true;
      }

      return { ordenAprobada: ordenActualizada, printJobQueued: queued };
    });

    return NextResponse.json({
      success: true,
      orden: {
        id: ordenAprobada.id,
        estado: ordenAprobada.estado,
        aprobadaPorId: ordenAprobada.aprobadaPorId,
        razonAprobacion: ordenAprobada.razonAprobacion,
      },
      impresionEnCola: printJobQueued,
      mensaje: 'Orden aprobada exitosamente',
    });
  } catch (error) {
    if (error instanceof ApprovalConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error al aprobar orden:', error);
    return NextResponse.json(
      { error: 'Error al aprobar orden' },
      { status: 500 }
    );
  }
}
