import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validarProductoNuevo } from '@/lib/admin-validaciones';

export async function GET(request: Request) {
  try {
    // Sin ?vista=admin la respuesta es la de siempre: solo lo que se puede vender.
    const vistaAdmin = new URL(request.url).searchParams.get('vista') === 'admin';

    const productos = await prisma.producto.findMany({
      where: vistaAdmin ? undefined : { disponible: true },
      orderBy: [{ createdAt: 'asc' }],
    });
    return NextResponse.json(productos);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const validacion = validarProductoNuevo(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const datos = validacion.data;
    const duplicado = await prisma.producto.findFirst({
      where: { nombre: { equals: datos.nombre, mode: 'insensitive' } },
    });

    if (duplicado) {
      return NextResponse.json(
        { error: `Ya existe un producto llamado "${duplicado.nombre}"` },
        { status: 409 },
      );
    }

    const producto = await prisma.producto.create({ data: datos });
    return NextResponse.json(producto, { status: 201 });
  } catch (error) {
    console.error('Error al crear producto:', error);
    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}
