import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Si cocina marca la orden como 'entregada' y ya fue cobrada, cerrarla directamente.
    let estadoFinal = body.estado;
    if (estadoFinal === 'entregada') {
      const existente = await prisma.orden.findUnique({
        where: { id },
        select: { cobrada: true },
      });
      if (existente?.cobrada) estadoFinal = 'cobrada';
    }

    const orden = await prisma.orden.update({
      where: { id },
      data: { estado: estadoFinal },
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
    console.error('Error al actualizar orden:', error);
    return NextResponse.json({ error: 'Error al actualizar orden' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.orden.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar orden:', error);
    return NextResponse.json({ error: 'Error al eliminar orden' }, { status: 500 });
  }
}
