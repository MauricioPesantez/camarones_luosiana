import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { canUserCollectOrder } from '@/lib/order-payment';
import { getAuthenticatedUser } from '@/lib/session';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    const { id } = await params;
    const orden = await prisma.orden.findUnique({
      where: { id },
      select: { creadorId: true, mesero: true },
    });
    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }
    if (!canUserCollectOrder(usuario, orden)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }
    const historial = await prisma.historialOrden.findMany({
      where: { ordenId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(historial);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial' },
      { status: 500 }
    );
  }
}
