import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validarAnulacionOrden } from '@/lib/ordenes-anulacion';
import { PRINT_JOB_STATUSES } from '@/lib/print-jobs';
import { getAuthenticatedUser } from '@/lib/session';

class AnulacionConflictError extends Error {}

/** Trabajos que todavia podrian salir por la impresora si nadie los detiene. */
const PRINT_JOBS_DETENIBLES = [
  PRINT_JOB_STATUSES.PENDING,
  PRINT_JOB_STATUSES.RETRY,
  PRINT_JOB_STATUSES.NEEDS_REVIEW,
];

/**
 * Anula una orden de forma logica.
 *
 * La orden no se borra: queda con `anulada = true`, su razon y su autor, y sale
 * de todas las cifras del cuadre. Se conserva porque el numero diario, el
 * historial y un cobro ya registrado tienen que seguir siendo auditables.
 *
 * Lo que la anulacion NO hace, a proposito:
 * - no devuelve stock: el producto pudo haberse preparado o botado, y eso lo
 *   decide una persona desde la pantalla de productos;
 * - no borra el `Cobro`: si la orden estaba cobrada, el pago queda marcado como
 *   `REEMBOLSO_PENDIENTE` para que ningun reporte lo lea como venta confirmada.
 *   Ese dinero ya no aparece como deuda en el cuadre: anular significa que la
 *   plata se devuelve junto con la anulacion, no que la orden queda a medias.
 */
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
        { error: 'Solo un administrador puede anular una orden' },
        { status: 403 },
      );
    }

    const validacion = validarAnulacionOrden(await request.json());

    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const { razon } = validacion.data;

    const existente = await prisma.orden.findUnique({
      where: { id },
      select: {
        id: true,
        anulada: true,
        estado: true,
        cobrada: true,
        metodoPago: true,
        total: true,
      },
    });

    if (!existente) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    if (existente.anulada) {
      return NextResponse.json(
        { error: 'Esta orden ya fue anulada' },
        { status: 400 },
      );
    }

    const orden = await prisma.$transaction(async (tx) => {
      const anuladaAt = new Date();
      // Anulacion optimista: si otro admin la gano en el camino, `count` es 0.
      const anulacion = await tx.orden.updateMany({
        where: { id, anulada: false },
        data: {
          anulada: true,
          anuladaPorId: admin.id,
          anuladaPorNombre: admin.nombre,
          razonAnulacion: razon,
          anuladaAt,
        },
      });

      if (anulacion.count !== 1) {
        throw new AnulacionConflictError('La orden fue anulada al mismo tiempo.');
      }

      await tx.historialOrden.create({
        data: {
          ordenId: id,
          tipoAccion: 'orden_anulada',
          descripcion: `Orden anulada por ${admin.nombre}`,
          datosAntes: {
            anulada: false,
            estado: existente.estado,
            cobrada: existente.cobrada,
            metodoPago: existente.metodoPago,
            total: Number(existente.total),
          },
          datosDespues: {
            anulada: true,
            anuladaPor: admin.nombre,
          },
          usuarioNombre: admin.nombre,
          usuarioRol: admin.rol,
          razon,
          // Impacto en el cuadre: la venta completa deja de contar.
          diferenciaTotal: -Number(existente.total),
        },
      });

      // El dinero que ya entro no se puede hacer desaparecer con la orden: se
      // convierte en una deuda visible hasta que alguien lo devuelva.
      if (existente.cobrada) {
        await tx.cobro.updateMany({
          where: { ordenId: id, estado: 'CONFIRMADO' },
          data: { estado: 'REEMBOLSO_PENDIENTE' },
        });
      }

      // Una comanda anulada no tiene por que llegar a la cocina.
      await tx.printJob.updateMany({
        where: { ordenId: id, status: { in: PRINT_JOBS_DETENIBLES } },
        data: {
          status: PRINT_JOB_STATUSES.DISCARDED,
          reviewedAt: anuladaAt,
          reviewedBy: admin.nombre,
          reviewReason: `Orden anulada: ${razon}`,
        },
      });

      return tx.orden.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          estado: true,
          cobrada: true,
          anulada: true,
          anuladaPorNombre: true,
          razonAnulacion: true,
          anuladaAt: true,
        },
      });
    });

    return NextResponse.json({
      ...orden,
      anuladaAt: orden.anuladaAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof AnulacionConflictError) {
      return NextResponse.json(
        { error: 'La orden ya había sido anulada. Recarga el cuadre.' },
        { status: 409 },
      );
    }
    console.error('Error al anular la orden:', error);
    return NextResponse.json(
      { error: 'Error al anular la orden' },
      { status: 500 },
    );
  }
}
