import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');

    if (!fecha) {
      return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 });
    }

    // Inicio y fin del día en la zona horaria local (Ecuador UTC-5)
    // Construir la fecha correctamente para evitar problemas de zona horaria
    const [year, month, day] = fecha.split('-').map(Number);

    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

    const ordenes = await prisma.orden.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            producto: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(ordenes);
  } catch (error) {
    console.error('Error en cuadre:', error);
    return NextResponse.json({ error: 'Error al obtener cuadre' }, { status: 500 });
  }
}
