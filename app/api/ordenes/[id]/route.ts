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
      select: { cobrada: true, anulada: true },
    });

    if (!existente) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    if (existente.anulada) {
      return NextResponse.json(
        { error: 'Una orden anulada no cambia de estado' },
        { status: 409 },
      );
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

/**
 * Una orden no se borra nunca: se anula con
 * `PATCH /api/ordenes/[id]/anular`, que exige una razon y la deja fuera del
 * cuadre sin perder el numero diario, el historial ni el cobro.
 *
 * Borrarla de verdad se llevaria por cascada sus items, su historial y sus
 * trabajos de impresion, y dejaria un hueco en la numeracion del dia.
 */
export async function DELETE() {
  return NextResponse.json(
    {
      error:
        'Las ordenes no se eliminan. Anula la orden para sacarla del cuadre conservando su historial.',
    },
    { status: 405 },
  );
}
