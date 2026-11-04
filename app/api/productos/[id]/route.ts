import { getAuthenticatedUser } from '@/lib/session';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizarNombre, validarProductoParcial } from '@/lib/admin-validaciones';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getAuthenticatedUser();
    if (!actor) return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    if (actor.rol !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede realizar esta operacion' }, { status: 403 });
    const { id } = await params;
    const validacion = validarProductoParcial(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const datos = validacion.data;
    const producto = await prisma.producto.findUnique({ where: { id } });

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const precioFinal = datos.precio ?? Number(producto.precio);
    const especialFinal = datos.precioEmpleado === undefined ? (producto.precioEmpleado === null ? null : Number(producto.precioEmpleado)) : datos.precioEmpleado;
    if (especialFinal !== null && especialFinal > precioFinal) {
      return NextResponse.json({ error: 'El precio para empleados no puede superar el precio de carta' }, { status: 400 });
    }

    if (datos.nombre) {
      const nombreBuscado = normalizarNombre(datos.nombre);
      const existentes = await prisma.producto.findMany({
        where: { id: { not: id } },
        select: { nombre: true },
      });
      const duplicado = existentes.find(
        (otro) => normalizarNombre(otro.nombre) === nombreBuscado,
      );

      if (duplicado) {
        return NextResponse.json(
          { error: `Ya existe un producto llamado "${duplicado.nombre}"` },
          { status: 409 },
        );
      }
    }

    const actualizado = await prisma.producto.update({ where: { id }, data: datos });
    return NextResponse.json(actualizado);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return NextResponse.json({ error: 'Error al actualizar producto' }, { status: 500 });
  }
}
