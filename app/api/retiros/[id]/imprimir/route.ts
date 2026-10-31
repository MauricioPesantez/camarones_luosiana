import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PrinterService } from '@/lib/printer';
import { RETIRO_SELECT } from '@/lib/retiros';
import { getAuthenticatedUser } from '@/lib/session';
import { buildWithdrawalPrintPayload, enqueueWithdrawalPrintJob, getWithdrawalPrintMode } from '@/lib/withdrawal-print';
import { calculateAutoPrintUntil } from '@/lib/print-jobs';

class ReceiptError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await getAuthenticatedUser();
    if (!usuario) return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
    const { id } = await params;
    const mode = getWithdrawalPrintMode(new Date());
    const result = await prisma.$transaction(async (tx) => {
      // Serializa las solicitudes de copia y la anulacion del mismo retiro.
      await tx.$queryRaw`SELECT id FROM "RetiroCaja" WHERE id = ${id} FOR UPDATE`;
      const retiro = await tx.retiroCaja.findUnique({ where: { id }, select: RETIRO_SELECT });
      if (!retiro) throw new ReceiptError('Retiro no encontrado', 404);
      if (usuario.rol !== 'admin' && retiro.usuarioId !== usuario.id) {
        throw new ReceiptError('No puedes imprimir este retiro', 403);
      }
      if (retiro.estado !== 'registrado') throw new ReceiptError('El retiro esta anulado', 409);
      if (mode === 'disabled') throw new ReceiptError('No hay un mecanismo de impresion activo', 409);
      if (mode === 'direct') return { retiro, job: null };

      const last = await tx.printJob.findFirst({ where: { retiroId: id }, orderBy: { revision: 'desc' } });
      if (last && ['PENDING', 'RETRY', 'PROCESSING'].includes(last.status)) return { retiro, job: last };
      const now = new Date();
      if (last && ['NEEDS_REVIEW', 'FAILED'].includes(last.status)) {
        const job = await tx.printJob.update({
          where: { id: last.id },
          data: {
            payload: buildWithdrawalPrintPayload(retiro, true) as unknown as Prisma.InputJsonValue,
            status: 'PENDING', attempts: 0, availableAt: now, autoPrintUntil: calculateAutoPrintUntil(now),
            lastError: null, lastErrorCode: null, workerId: null, leasedAt: null, leaseExpiresAt: null,
            reviewedAt: now, reviewedBy: usuario.nombre, reviewReason: 'Reintento de comprobante solicitado',
          },
        });
        return { retiro, job };
      }
      const created = await enqueueWithdrawalPrintJob(tx, retiro, last ? last.revision + 1 : 1, now);
      const job = await tx.printJob.update({
        where: { id: created.id },
        data: { reviewedAt: now, reviewedBy: usuario.nombre, reviewReason: 'Copia de comprobante solicitada' },
      });
      return { retiro, job };
    });
    if (result.job) return NextResponse.json({ impresionEnCola: true, estadoImpresion: result.job.status });
    const sent = await new PrinterService().imprimirRetiro(buildWithdrawalPrintPayload(result.retiro, true));
    return NextResponse.json({ impresionEnviada: sent.success, impresionError: sent.success ? null : 'No se pudo enviar el comprobante a la impresora' });
  } catch (error) {
    if (error instanceof ReceiptError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error al imprimir comprobante de retiro:', error);
    return NextResponse.json({ error: 'No se pudo imprimir el comprobante' }, { status: 500 });
  }
}
