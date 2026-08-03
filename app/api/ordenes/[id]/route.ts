import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';

const ALLOWED_STATES = new Set([
  'pendiente',
  'en_preparacion',
  'lista',
  'entregada',
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (!['cocina', 'admin'].includes(usuario.rol)) {
      return NextResponse.json({ error: 'Rol no autorizado' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    if (!ALLOWED_STATES.has(body.estado)) {
      return NextResponse.json({ error: 'Estado de orden no válido' }, { status: 400 });
    }
    const existente = await prisma.orden.findUnique({
      where: { id },
      select: { cobrada: true },
    });

    if (!existente) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    // Si cocina marca la orden como 'entregada' y ya fue cobrada, cerrarla directamente.
    let estadoFinal = body.estado;
    if (estadoFinal === 'entregada' && existente.cobrada) {
      estadoFinal = 'cobrada';
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
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (usuario.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }
    const { id } = await params;
    const orden = await prisma.orden.findUnique({
      where: { id },
      select: { cobrada: true },
    });
    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }
    if (orden.cobrada) {
      return NextResponse.json(
        { error: 'Una orden cobrada no se elimina; debe registrarse un reembolso' },
        { status: 409 },
      );
    }
    await prisma.orden.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar orden:', error);
    return NextResponse.json({ error: 'Error al eliminar orden' }, { status: 500 });
  }
}
