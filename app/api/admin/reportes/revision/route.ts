import { NextResponse } from 'next/server';

import { armarBitacora, type FilaBitacora } from '@/lib/bitacora-revision';
import { prisma } from '@/lib/db';
import { obtenerRangoEcuador } from '@/lib/fecha-ecuador';
import { getAuthenticatedUser } from '@/lib/session';
import { sePuedeRevisar, type DetalleRevision, type OrdenRevisable } from '@/types/revision';

export async function GET(request: Request) {
  try {
    const admin = await getAuthenticatedUser();
    if (!admin) {
      return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    }
    if (admin.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const params = new URL(request.url).searchParams;
    const primero = obtenerRangoEcuador(params.get('fechaInicio') ?? '');
    const ultimo = obtenerRangoEcuador(params.get('fechaFin') ?? '');
    if (!primero || !ultimo || ultimo.inicio < primero.inicio) {
      return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 });
    }

    // Sin nombre, teléfono ni dirección del cliente: la bitácora no los necesita.
    const revisiones = await prisma.revisionOrden.findMany({
      where: {
        revisada: true,
        orden: { anulada: false, createdAt: { gte: primero.inicio, lt: ultimo.fin } },
      },
      select: {
        ordenId: true,
        detalle: true,
        revisada: true,
        conErrores: true,
        version: true,
        revisadaPorNombre: true,
        revisadaAt: true,
        orden: {
          select: {
            id: true,
            numeroDiario: true,
            createdAt: true,
            mesero: true,
            creador: { select: { nombre: true } },
            cobradaPor: true,
            tipoOperacion: true,
            empleadoId: true,
            anulada: true,
            estado: true,
            total: true,
            items: {
              select: {
                id: true,
                cantidad: true,
                nivelPicante: true,
                precioUnitario: true,
                nombreProducto: true,
                producto: { select: { nombre: true } },
              },
            },
            pagos: { select: { metodoPago: true, monto: true, estado: true } },
          },
        },
      },
    });

    // Una orden revisada que después se anuló o rechazó deja de contar: la misma regla que la pantalla.
    const vigentes = revisiones.filter((r) => sePuedeRevisar(r.orden as unknown as OrdenRevisable));
    const filas = vigentes.map(({ orden, ...r }): FilaBitacora => ({
      orden: {
        ...(orden as unknown as OrdenRevisable),
        id: orden.id,
        numeroDiario: orden.numeroDiario,
        createdAt: orden.createdAt,
        creadorNombre: orden.creador?.nombre ?? orden.mesero,
        cobradaPor: orden.cobradaPor,
      },
      revision: {
        ...r,
        detalle: r.detalle as unknown as DetalleRevision,
        revisadaAt: r.revisadaAt ? r.revisadaAt.toISOString() : null,
      },
    }));

    return NextResponse.json(armarBitacora(filas));
  } catch (error) {
    console.error('Error en la bitácora de revisión:', error);
    return NextResponse.json({ error: 'Error al armar la bitácora' }, { status: 500 });
  }
}
