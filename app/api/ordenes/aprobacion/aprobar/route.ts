import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AprobarOrdenRequest } from '@/types/orden';
import {
  PRINT_JOB_TYPES,
  enqueueOrderPrintJob,
  shouldEnqueuePrintJob,
} from '@/lib/print-jobs';
import { getAuthenticatedUser } from '@/lib/session';
import { calcularMovimientosPago } from '@/types/cobro';

class ApprovalConflictError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthenticatedUser();
    if (!admin) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (admin.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo los administradores pueden aprobar órdenes' }, { status: 403 });
    }
    const body: AprobarOrdenRequest = await request.json();
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

    if (orden.anulada) {
      return NextResponse.json(
        { error: 'La orden fue anulada y ya no puede aprobarse' },
        { status: 409 }
      );
    }

    if (orden.estado !== 'pendiente_aprobacion_stock') {
      return NextResponse.json(
        { error: 'La orden no está pendiente de aprobación por stock' },
        { status: 400 }
      );
    }

    const pagarTransferencia =
      orden.tipoOrden === 'domicilio' &&
      orden.metodoPagoPrevisto === 'transferencia' &&
      orden.transferenciaConfirmadaAlCrear &&
      !orden.cobrada;

    // Descontar el stock de los productos
    // Usamos una transacción para asegurar atomicidad
    const { ordenAprobada, printJobQueued } = await prisma.$transaction(async (tx) => {
      const transicion = await tx.orden.updateMany({
        where: {
          id: ordenId,
          estado: 'pendiente_aprobacion_stock',
          // Si la anularon mientras se decidia, no se descuenta stock ni se cobra.
          anulada: false,
        },
        data: {
          estado: 'pendiente',
          sinStock: true,
          aprobadaPorId: admin.id,
          razonAprobacion: razon || 'Aprobada por administrador',
          ...(pagarTransferencia && {
            cobrada: true,
            montoPagado: orden.total,
            metodoPago: 'transferencia',
            fechaCobro: new Date(),
            cobradaPor: orden.mesero,
            cobradaPorId: orden.creadorId,
            origenCobro: 'aprobacion_domicilio_transferencia',
          }),
        },
      });

      if (transicion.count !== 1) {
        throw new ApprovalConflictError(
          'La orden ya fue procesada o anulada por otra solicitud.',
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

      if (pagarTransferencia) {
        const movimientos = calcularMovimientosPago({
          metodoPago: 'transferencia',
          monto: orden.total.toString(),
        });
        await tx.cobro.create({
          data: {
            ordenId,
            metodoPago: 'transferencia',
            monto: orden.total,
            montoTotal: orden.total,
            costoEnvio: orden.costoEnvio ?? 0,
            ...movimientos,
            cobradoPorId: orden.creadorId,
            cobradoPorNombre: orden.mesero,
            cobradoPorRol: orden.creadorRol ?? 'desconocido',
            origen: 'aprobacion_domicilio_transferencia',
            idempotencyKey: `auto_${ordenId}`,
          },
        });
        await tx.historialOrden.create({
          data: {
            ordenId,
            tipoAccion: 'orden_cobrada_automaticamente',
            descripcion: 'Transferencia confirmada al aprobar la orden sin stock',
            datosDespues: {
              metodoPago: 'transferencia',
              total: Number(orden.total),
              costoEnvio: Number(orden.costoEnvio ?? 0),
              ...movimientos,
            },
            usuarioNombre: admin.nombre,
            usuarioRol: admin.rol,
            diferenciaTotal: 0,
          },
        });
      }

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
