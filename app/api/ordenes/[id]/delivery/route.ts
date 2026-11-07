import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { cancelarRecordatorios } from '@/lib/whatsapp-salidas';

const ESTADOS_SIN_PREPARACION = new Set(['cancelada', 'pendiente_aprobacion_stock']);

/** Registra que alguien pidió motorizado fuera del sistema. No lo contrata ni toca el pago. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }

    const body = await request.json();
    if (body?.accion !== 'solicitar') {
      return NextResponse.json({ error: 'Acción de delivery no válida' }, { status: 400 });
    }

    const { id } = await params;
    const orden = await prisma.orden.findUnique({
      where: { id },
      select: {
        tipoOrden: true,
        tipoOperacion: true,
        anulada: true,
        estado: true,
        creadorId: true,
        deliverySolicitadoAt: true,
      },
    });
    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }
    const autorizado =
      usuario.rol === 'admin' ||
      (usuario.rol === 'digital' && orden.creadorId === usuario.id);
    if (!autorizado) {
      return NextResponse.json({ error: 'No puedes solicitar delivery para esta orden' }, { status: 403 });
    }
    if (orden.tipoOperacion !== 'VENTA_CLIENTE' || orden.tipoOrden !== 'domicilio') {
      return NextResponse.json({ error: 'Solo los domicilios usan delivery' }, { status: 409 });
    }
    if (orden.anulada || ESTADOS_SIN_PREPARACION.has(orden.estado)) {
      return NextResponse.json({ error: 'Esta orden no admite solicitud de delivery' }, { status: 409 });
    }
    if (orden.deliverySolicitadoAt) {
      return NextResponse.json({ deliverySolicitadoAt: orden.deliverySolicitadoAt });
    }

    const deliverySolicitadoAt = new Date();
    const registrada = await prisma.$transaction(async (tx) => {
      const { count } = await tx.orden.updateMany({
        where: { id, anulada: false, deliverySolicitadoAt: null },
        data: { deliverySolicitadoAt },
      });
      if (count !== 1) return false;
      await tx.historialOrden.create({
        data: {
          ordenId: id,
          tipoAccion: 'delivery_solicitado',
          descripcion: 'Delivery solicitado',
          datosDespues: { deliverySolicitadoAt: deliverySolicitadoAt.toISOString() },
          usuarioNombre: usuario.nombre,
          usuarioRol: usuario.rol,
          diferenciaTotal: 0,
        },
      });
      await cancelarRecordatorios(tx, id, 'DELIVERY_SOLICITADO');
      return true;
    });
    if (registrada) {
      return NextResponse.json({ deliverySolicitadoAt });
    }

    // Otra solicitud ganó la carrera, o la anularon mientras tanto.
    const actual = await prisma.orden.findUnique({
      where: { id },
      select: { deliverySolicitadoAt: true },
    });
    if (!actual?.deliverySolicitadoAt) {
      return NextResponse.json({ error: 'Esta orden no admite solicitud de delivery' }, { status: 409 });
    }
    return NextResponse.json({ deliverySolicitadoAt: actual.deliverySolicitadoAt });
  } catch (error) {
    console.error('Error al registrar delivery:', error);
    return NextResponse.json({ error: 'Error al registrar delivery' }, { status: 500 });
  }
}
