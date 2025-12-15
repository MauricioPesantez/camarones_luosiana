import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const productos = await prisma.producto.findMany({
      where: { disponible: true },
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });
    return NextResponse.json(productos);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const producto = await prisma.producto.create({
      data: {
        nombre: body.nombre,
        categoria: body.categoria,
        precio: body.precio,
        descripcion: body.descripcion,
      },
    });
    return NextResponse.json(producto);
  } catch (error) {
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}
