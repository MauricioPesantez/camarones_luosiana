import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CobrarOrdenRequest, esMetodoPago } from '@/types/orden';

class PaymentConflictError extends Error {}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: CobrarOrdenRequest = await request.json();

    const { metodoPago, cobradaPor, expectedRevision } = body;

    if (!cobradaPor || cobradaPor.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre de quien cobra es requerido' },
        { status: 400 }
      );
    }

    // Validar método de pago
    if (!esMetodoPago(metodoPago)) {
      return NextResponse.json(
        { error: 'Método de pago inválido. Use: efectivo o transferencia' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      return NextResponse.json(
        { error: 'La revisión esperada de la orden es requerida' },
        { status: 400 },
      );
    }

    // Verificar que la orden existe y no está ya cobrada
    const ordenExistente = await prisma.orden.findUnique({
      where: { id },
    });

    if (!ordenExistente) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    if (ordenExistente.cobrada) {
      return NextResponse.json(
        { error: 'Esta orden ya fue cobrada' },
        { status: 400 }
      );
    }

    if (ordenExistente.printRevision !== expectedRevision) {
      return NextResponse.json(
        {
          error:
            'La orden cambió mientras se preparaba el cobro. Recárgala y confirma el total actualizado.',
        },
        { status: 409 },
      );
    }

    if (ordenExistente.estado === 'cancelada') {
      return NextResponse.json(
        { error: 'No se puede cobrar una orden cancelada' },
        { status: 400 }
      );
    }

    const esLocal = !ordenExistente.tipoOrden || ordenExistente.tipoOrden === 'local';
    const estadosListos = ['lista', 'entregada', 'cobrada'];

    // Para órdenes locales: solo se cobra cuando la comida ya está lista/entregada
    // (el cliente come primero, luego paga).
    if (esLocal && !estadosListos.includes(ordenExistente.estado)) {
      return NextResponse.json(
        { error: 'Las órdenes de mesa solo se pueden cobrar cuando estén listas o entregadas' },
        { status: 400 }
      );
    }

    // Para domicilio/para_llevar: el pago puede llegar antes de que cocina termine
    // (ej. transferencia anticipada). En ese caso registramos el cobro pero dejamos
    // el estado intacto para que cocina siga viendo la orden.
    const nuevoEstado = estadosListos.includes(ordenExistente.estado)
      ? 'cobrada'
      : ordenExistente.estado;

    // El cliente puede terminar pagando distinto a lo acordado al crear la orden.
    // Se permite, pero queda auditado: la liquidación con el motorizado cambia.
    const metodoPagoPrevisto = ordenExistente.metodoPagoPrevisto;
    const huboOverride =
      esMetodoPago(metodoPagoPrevisto) && metodoPagoPrevisto !== metodoPago;

    const orden = await prisma.$transaction(async (tx) => {
      const paymentUpdate = await tx.orden.updateMany({
        where: {
          id,
          cobrada: false,
          printRevision: expectedRevision,
        },
        data: {
          metodoPago,
          cobrada: true,
          fechaCobro: new Date(),
          cobradaPor: cobradaPor.trim(),
          estado: nuevoEstado,
        },
      });

      if (paymentUpdate.count !== 1) {
        throw new PaymentConflictError(
          'La orden fue cobrada o modificada al mismo tiempo.',
        );
      }

      const actualizada = await tx.orden.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            include: {
              producto: true,
            },
          },
        },
      });

      if (huboOverride) {
        await tx.historialOrden.create({
          data: {
            ordenId: id,
            tipoAccion: 'metodo_pago_override',
            descripcion:
              `Cobro en ${metodoPago} sobre una orden acordada en ${metodoPagoPrevisto}`,
            datosAntes: { metodoPagoPrevisto },
            datosDespues: {
              metodoPago,
              costoEnvio: Number(actualizada.costoEnvio ?? 0),
              total: Number(actualizada.total),
            },
            usuarioNombre: cobradaPor.trim(),
            usuarioRol: 'mesero',
            razon: 'El cliente pagó con un método distinto al acordado',
            diferenciaTotal: 0,
          },
        });
      }

      return actualizada;
    });

    return NextResponse.json({ ...orden, metodoPagoOverride: huboOverride });
  } catch (error) {
    if (error instanceof PaymentConflictError) {
      return NextResponse.json(
        {
          error:
            'La orden cambió durante el cobro. Recárgala y confirma el total actualizado.',
        },
        { status: 409 },
      );
    }
    console.error('Error al registrar el cobro:', error);
    return NextResponse.json(
      { error: 'Error al registrar el cobro' },
      { status: 500 }
    );
  }
}
