import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { UbicacionInvalidaError, parsearUbicacionEntrega } from '@/lib/delivery-location';
import { canUserModifyOrder } from '@/lib/order-payment';
import { getAuthenticatedUser } from '@/lib/session';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }

    const { id } = await params;
    const orden = await prisma.orden.findUnique({
      where: { id },
      select: {
        tipoOrden: true,
        tipoOperacion: true,
        anulada: true,
        creadorId: true,
        mesero: true,
        ubicacionUrl: true,
        referenciaEntrega: true,
      },
    });
    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }
    if (!canUserModifyOrder(usuario, orden)) {
      return NextResponse.json({ error: 'No puedes modificar esta orden' }, { status: 403 });
    }
    if (orden.tipoOperacion !== 'VENTA_CLIENTE' || orden.tipoOrden !== 'domicilio') {
      return NextResponse.json({ error: 'Solo los domicilios tienen ubicación de entrega' }, { status: 409 });
    }
    if (orden.anulada) {
      return NextResponse.json({ error: 'Una orden anulada no cambia de ubicación' }, { status: 409 });
    }

    const body = await request.json();
    // Vaciar es válido; un cuerpo incompleto no debe borrar lo guardado.
    if (body?.ubicacionUrl === undefined || body?.referenciaEntrega === undefined) {
      return NextResponse.json({ error: 'Faltan datos de ubicación' }, { status: 400 });
    }
    const despues = parsearUbicacionEntrega(body);
    const antes = { ubicacionUrl: orden.ubicacionUrl, referenciaEntrega: orden.referenciaEntrega };
    if (
      despues.ubicacionUrl === antes.ubicacionUrl &&
      despues.referenciaEntrega === antes.referenciaEntrega
    ) {
      return NextResponse.json(antes);
    }

    const actualizada = await prisma.$transaction(async (tx) => {
      const { count } = await tx.orden.updateMany({
        where: { id, anulada: false, ...antes },
        data: despues,
      });
      if (count !== 1) return false;
      await tx.historialOrden.create({
        data: {
          ordenId: id,
          tipoAccion: 'ubicacion_actualizada',
          descripcion: 'Ubicación de entrega actualizada',
          datosAntes: antes,
          datosDespues: despues,
          usuarioNombre: usuario.nombre,
          usuarioRol: usuario.rol,
          diferenciaTotal: 0,
        },
      });
      return true;
    });
    if (!actualizada) {
      return NextResponse.json(
        { error: 'La orden cambió mientras se editaba. Recarga e intenta nuevamente.' },
        { status: 409 },
      );
    }

    return NextResponse.json(despues);
  } catch (error) {
    if (error instanceof UbicacionInvalidaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error al actualizar ubicación:', error);
    return NextResponse.json({ error: 'Error al actualizar ubicación' }, { status: 500 });
  }
}
