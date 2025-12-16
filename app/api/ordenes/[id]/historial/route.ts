import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
