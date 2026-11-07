import { getAuthenticatedUser } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizarNombre, validarProductoNuevo } from '@/lib/admin-validaciones';

export async function GET(request: Request) {
  try {
    // Sin ?vista=admin la respuesta es la de siempre: solo lo que se puede vender.
    const vistaAdmin = new URL(request.url).searchParams.get('vista') === 'admin';

    if (vistaAdmin) {
    const actor = await getAuthenticatedUser();
    if (!actor) return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    if (actor.rol !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede realizar esta operacion' }, { status: 403 });
    }

    const productos = await prisma.producto.findMany({
      where: vistaAdmin ? undefined : { disponible: true },
      orderBy: [{ createdAt: 'asc' }],
    });
    return NextResponse.json(vistaAdmin ? productos : productos.map(({ precioEmpleado: _precioEmpleado, requierePreparacionEmpleado: _preparacion, ...producto }) => { void _precioEmpleado; void _preparacion; return producto; }));
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedUser();
    if (!actor) return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    if (actor.rol !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede realizar esta operacion' }, { status: 403 });
    const validacion = validarProductoNuevo(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const datos = validacion.data;
    // La comparacion va en memoria porque debe ignorar tildes ademas de
    // mayusculas, y Postgres solo ignora mayusculas.
    const nombreBuscado = normalizarNombre(datos.nombre);
    const existentes = await prisma.producto.findMany({ select: { nombre: true } });
    const duplicado = existentes.find(
      (otro) => normalizarNombre(otro.nombre) === nombreBuscado,
    );

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
