import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { esMetodoPago } from '@/types/orden';

/**
 * Admin cambia el pago acordado de un domicilio (efectivo <-> transferencia)
 * antes de cobrarlo, p. ej. el cliente avisó que ahora transfiere. Solo cambia
 * el acuerdo: el dinero se registra después con el cobro normal.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAuthenticatedUser();
    if (!admin) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (admin.rol !== 'admin') {
      return NextResponse.json(
        { error: 'Solo un administrador puede cambiar el método de pago' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { metodoPago?: unknown } | null;
    const nuevo = body?.metodoPago;
    if (!esMetodoPago(nuevo)) {
      return NextResponse.json(
        { error: 'Método de pago no válido: efectivo o transferencia' },
        { status: 400 },
      );
    }

    const actual = await prisma.orden.findUnique({
      where: { id },
      select: { tipoOrden: true, anulada: true, estado: true, metodoPagoPrevisto: true },
    });
    if (!actual) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    if (actual.tipoOrden !== 'domicilio') {
      return NextResponse.json(
        { error: 'Solo los domicilios tienen un pago acordado; las demás órdenes eligen el método al cobrar' },
        { status: 400 },
      );
    }
    if (actual.anulada || actual.estado === 'cancelada') {
      return NextResponse.json({ error: 'La orden está anulada o rechazada' }, { status: 409 });
    }
    if (actual.metodoPagoPrevisto === nuevo) {
      return NextResponse.json({ error: `La orden ya está en ${nuevo}` }, { status: 400 });
    }

    const orden = await prisma.$transaction(async (tx) => {
      // El filtro por `montoPagado: 0` cierra la carrera con un cobro simultáneo.
      const updated = await tx.orden.updateMany({
        where: { id, montoPagado: 0, anulada: false, metodoPagoPrevisto: actual.metodoPagoPrevisto },
        data: { metodoPagoPrevisto: nuevo },
      });
      if (updated.count !== 1) return null;
      await tx.historialOrden.create({
        data: {
          ordenId: id,
          tipoAccion: 'metodo_pago_cambiado',
          descripcion: `Pago acordado cambiado de ${actual.metodoPagoPrevisto ?? 'sin definir'} a ${nuevo}`,
          datosAntes: { metodoPagoPrevisto: actual.metodoPagoPrevisto },
          datosDespues: { metodoPagoPrevisto: nuevo },
          usuarioNombre: admin.nombre,
          usuarioRol: admin.rol,
          diferenciaTotal: 0,
        },
      });
      return { id, metodoPagoPrevisto: nuevo };
    });
    if (!orden) {
      return NextResponse.json(
        { error: 'La orden ya tiene un pago registrado o cambió al mismo tiempo' },
        { status: 409 },
      );
    }

    return NextResponse.json({ orden });
  } catch (error) {
    console.error('Error al cambiar método de pago:', error);
    return NextResponse.json({ error: 'Error al cambiar método de pago' }, { status: 500 });
  }
}
