import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PrinterService } from '@/lib/printer';
import { PUBLIC_PRODUCT_SELECT } from '@/lib/product-select';
import { getAuthenticatedUser } from '@/lib/session';
import { getWithdrawalPrintMode } from '@/lib/withdrawal-print';
import { enqueueOrderPrintJob, PRINT_JOB_TYPES } from '@/lib/print-jobs';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    if (usuario.rol !== 'admin') return NextResponse.json({ error: 'Solo el admin puede reimprimir' }, { status: 403 });
    const { id } = await params;

    const orden = await prisma.orden.findUnique({
      where: { id },
      include: { items: { include: { producto: { select: PUBLIC_PRODUCT_SELECT } } } },
    });
    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    if (orden.estado === 'pendiente_aprobacion_stock') {
      return NextResponse.json({ error: 'La orden aun no esta aprobada' }, { status: 409 });
    }

    // Misma regla que retiros: cola si esta activa ahora, si no impresion directa.
    const mode = getWithdrawalPrintMode(new Date());
    if (mode === 'disabled') return NextResponse.json({ error: 'No hay un mecanismo de impresion activo' }, { status: 409 });

    if (mode === 'queue') {
      const last = await prisma.printJob.findFirst({
        where: { ordenId: id, type: PRINT_JOB_TYPES.REPRINT },
        orderBy: { revision: 'desc' },
      });
      // Doble clic simultaneo cae en el mismo dedupeKey y no duplica el ticket.
      const job = await enqueueOrderPrintJob(prisma, orden, {
        type: PRINT_JOB_TYPES.REPRINT,
        revision: last ? last.revision + 1 : 1,
        reason: 'Reimpresion solicitada por admin',
        requestedBy: usuario.nombre,
      });
      return NextResponse.json({ impresionEnCola: true, estadoImpresion: job.status });
    }

    const sent = await new PrinterService().imprimirComanda({ ...orden, nivelPicante: null });
    if (!sent.success) return NextResponse.json({ error: 'No se pudo enviar el ticket a la impresora' }, { status: 502 });
    return NextResponse.json({ impresionEnviada: true });
  } catch (error) {
    console.error('Error al reimprimir orden:', error);
    return NextResponse.json({ error: 'No se pudo reimprimir el ticket' }, { status: 500 });
  }
}
