import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MetodoPago, CobrarOrdenRequest } from '@/types/orden';

const METODOS_PAGO_VALIDOS: MetodoPago[] = ['efectivo', 'transferencia'];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: CobrarOrdenRequest = await request.json();

    const { metodoPago, cobradaPor } = body;

    if (!cobradaPor || cobradaPor.trim() === '') {
      return NextResponse.json(
        { error: 'El nombre de quien cobra es requerido' },
        { status: 400 }
      );
    }

    // Validar método de pago
    if (!metodoPago || !METODOS_PAGO_VALIDOS.includes(metodoPago)) {
      return NextResponse.json(
        { error: 'Método de pago inválido. Use: efectivo o transferencia' },
        { status: 400 }
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

    const orden = await prisma.orden.update({
      where: { id },
      data: {
        metodoPago,
        cobrada: true,
        fechaCobro: new Date(),
        cobradaPor: cobradaPor.trim(),
        estado: nuevoEstado,
      },
      include: {
        items: {
          include: {
            producto: true,
          },
        },
      },
    });

    return NextResponse.json(orden);
  } catch (error) {
    console.error('Error al registrar el cobro:', error);
    return NextResponse.json(
      { error: 'Error al registrar el cobro' },
      { status: 500 }
    );
  }
}
