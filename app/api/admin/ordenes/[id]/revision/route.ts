import { NextResponse } from 'next/server';
import { isDeepStrictEqual } from 'node:util';

import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import {
  construirDetalle,
  erroresDe,
  huellaOrden,
  pendientes,
  sePuedeRevisar,
  validarSolicitud,
  type OrdenRevisable,
  type RevisionGuardada,
} from '@/types/revision';

interface FilaRevision {
  ordenId: string;
  detalle: unknown;
  revisada: boolean;
  conErrores: boolean;
  version: number;
  revisadaPorId: string | null;
  revisadaPorNombre: string | null;
  revisadaAt: Date | null;
}

const aRespuesta = (fila: FilaRevision): RevisionGuardada => ({
  ordenId: fila.ordenId,
  detalle: fila.detalle as RevisionGuardada['detalle'],
  revisada: fila.revisada,
  conErrores: fila.conErrores,
  version: fila.version,
  revisadaPorNombre: fila.revisadaPorNombre,
  revisadaAt: fila.revisadaAt ? fila.revisadaAt.toISOString() : null,
});

const conflicto = (error: string, code: 'ORDEN_CAMBIO' | 'REVISION_CAMBIO' | 'NO_SE_REVISA') =>
  NextResponse.json({ error, code }, { status: 409 });

const REVISION_CAMBIO = 'Otro administrador guardó esta revisión. Recarga la orden.';

/**
 * Bitácora del admin sobre una orden. Solo escribe en RevisionOrden: no cambia
 * la orden, el cobro ni la caja.
 */
export async function PUT(
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
        { error: 'Solo un administrador puede revisar órdenes' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const solicitud = validarSolicitud(await request.json().catch(() => null));
    if (!solicitud.ok) {
      return NextResponse.json({ error: solicitud.error }, { status: 400 });
    }
    const { marcas, revisada, version, huella } = solicitud.data;

    // Sin datos del cliente: solo lo que necesita la comparación.
    const orden = (await prisma.orden.findUnique({
      where: { id },
      select: {
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
        mesero: true,
        creador: { select: { nombre: true } },
        cobradaPor: true,
      },
    })) as
      | (OrdenRevisable & {
          mesero: string;
          creador: { nombre: string } | null;
          cobradaPor: string | null;
        })
      | null;
    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }
    if (!sePuedeRevisar(orden)) {
      return conflicto('Esta orden no se revisa', 'NO_SE_REVISA');
    }
    if (huellaOrden(orden) !== huella) {
      return conflicto('La orden cambió. Recárgala para revisarla.', 'ORDEN_CAMBIO');
    }

    // Se busca en el catálogo completo, también lo no disponible.
    const idsFaltantes = marcas.faltantes.map((f) => f.productoId);
    const productos = idsFaltantes.length
      ? await prisma.producto.findMany({
          where: { id: { in: idsFaltantes } },
          select: { id: true, nombre: true, precio: true },
        })
      : [];
    const catalogo = new Map(productos.map((p) => [p.id, { nombre: p.nombre, precio: p.precio.toString() }]));

    const guardada = (await prisma.revisionOrden.findUnique({
      where: { ordenId: id },
    })) as FilaRevision | null;

    const construido = construirDetalle(
      orden,
      marcas,
      catalogo,
      (guardada?.detalle ?? null) as RevisionGuardada['detalle'] | null,
      { creador: orden.creador?.nombre ?? orden.mesero, cobrador: orden.cobradaPor },
    );
    if (!construido.ok) {
      return NextResponse.json({ error: construido.error }, { status: 400 });
    }
    if (revisada && pendientes(orden, marcas).cuantos > 0) {
      return NextResponse.json(
        { error: 'Faltan marcas para marcar la orden como revisada' },
        { status: 400 },
      );
    }
    // Pasa por JSON para que las llaves undefined no rompan la comparación con el JSONB.
    const detalle = JSON.parse(JSON.stringify(construido.detalle));
    const conErrores = erroresDe(construido.detalle).length > 0;

    // Reintento: la respuesta se perdió y la misma solicitud llega con la versión anterior.
    if (
      guardada &&
      guardada.version === version + 1 &&
      guardada.revisada === revisada &&
      isDeepStrictEqual(guardada.detalle, detalle) &&
      (!revisada || guardada.revisadaPorId === admin.id)
    ) {
      return NextResponse.json({ revision: aRespuesta(guardada) });
    }

    const quien = revisada
      ? { revisadaPorId: admin.id, revisadaPorNombre: admin.nombre, revisadaAt: new Date() }
      : { revisadaPorId: null, revisadaPorNombre: null, revisadaAt: null };

    if (!guardada) {
      if (version > 0) return conflicto(REVISION_CAMBIO, 'REVISION_CAMBIO');
      try {
        const creada = await prisma.revisionOrden.create({
          data: { ordenId: id, detalle, revisada, conErrores, version: 1, ...quien },
        });
        return NextResponse.json({ revision: aRespuesta(creada as FilaRevision) });
      } catch (error) {
        if ((error as { code?: string } | null)?.code === 'P2002') {
          return conflicto(REVISION_CAMBIO, 'REVISION_CAMBIO');
        }
        throw error;
      }
    }

    if (guardada.version !== version) return conflicto(REVISION_CAMBIO, 'REVISION_CAMBIO');
    const actualizada = await prisma.revisionOrden.updateMany({
      where: { ordenId: id, version },
      data: { detalle, revisada, conErrores, version: version + 1, ...quien },
    });
    if (actualizada.count !== 1) return conflicto(REVISION_CAMBIO, 'REVISION_CAMBIO');

    return NextResponse.json({
      revision: aRespuesta({
        ordenId: id, detalle, revisada, conErrores, version: version + 1, ...quien,
      }),
    });
  } catch (error) {
    console.error('Error al guardar la revisión:', error);
    return NextResponse.json({ error: 'Error al guardar la revisión' }, { status: 500 });
  }
}
