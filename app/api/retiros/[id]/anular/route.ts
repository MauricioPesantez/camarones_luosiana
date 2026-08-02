import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  ESTADO_ANULADO,
  ESTADO_REGISTRADO,
  RETIRO_SELECT,
  serializarRetiro,
} from '@/lib/retiros';
import { validarAnulacion } from '@/lib/retiros-validaciones';
import { getAuthenticatedUser } from '@/lib/session';

class AnulacionConflictError extends Error {}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const admin = await getAuthenticatedUser();
    if (!admin) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (admin.rol !== 'admin') {
      return NextResponse.json(
        { error: 'Solo un administrador puede anular un retiro' },
        { status: 403 },
      );
    }

    const validacion = validarAnulacion(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const { razon } = validacion.data;

    const existente = await prisma.retiroCaja.findUnique({
      where: { id },
      select: { id: true, estado: true },
    });

    if (!existente) {
      return NextResponse.json({ error: 'Retiro no encontrado' }, { status: 404 });
    }

    if (existente.estado === ESTADO_ANULADO) {
      return NextResponse.json(
        { error: 'Este retiro ya fue anulado' },
        { status: 400 },
      );
    }

    const retiro = await prisma.$transaction(async (tx) => {
      // Anulacion optimista: si otro admin la gano en el camino, `count` es 0.
      const anulacion = await tx.retiroCaja.updateMany({
        where: { id, estado: ESTADO_REGISTRADO },
        data: {
          estado: ESTADO_ANULADO,
          anuladoPorId: admin.id,
          anuladoPorNombre: admin.nombre,
          razonAnulacion: razon,
          anuladoAt: new Date(),
        },
      });

      if (anulacion.count !== 1) {
        throw new AnulacionConflictError('El retiro fue anulado al mismo tiempo.');
      }

      return tx.retiroCaja.findUniqueOrThrow({
        where: { id },
        select: RETIRO_SELECT,
      });
    });

    return NextResponse.json(serializarRetiro(retiro));
  } catch (error) {
    if (error instanceof AnulacionConflictError) {
      return NextResponse.json(
        { error: 'El retiro ya había sido anulado. Recarga el cuadre.' },
        { status: 409 },
      );
    }
    console.error('Error al anular el retiro:', error);
    return NextResponse.json(
      { error: 'Error al anular el retiro' },
      { status: 500 },
    );
  }
}
