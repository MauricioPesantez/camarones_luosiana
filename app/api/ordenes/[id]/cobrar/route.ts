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

    // Registrar el cobro
    const orden = await prisma.orden.update({
      where: { id },
      data: {
        metodoPago,
        cobrada: true,
        fechaCobro: new Date(),
        cobradaPor: cobradaPor.trim(),
        estado: 'cobrada',
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
  } catch {
    return NextResponse.json(
      { error: 'Error al registrar el cobro' },
      { status: 500 }
    );
  }
}
