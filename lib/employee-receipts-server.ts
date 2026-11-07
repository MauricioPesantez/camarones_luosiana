import { prisma } from '@/lib/db';
import { AccountError, lockEmployeeAccount } from '@/lib/employee-account';
import { buildEmployeeSettlementLines, employeeReceiptMode, enqueueEmployeeReceipt, sendEmployeeReceiptAfterCommit } from '@/lib/employee-print';
import type { AuthenticatedUser } from '@/lib/session';

export async function printEmployeeReceipt(actor: AuthenticatedUser, input: { ordenId?: string; empleadoId?: string; liquidacionId?: string }) {
  const result = await prisma.$transaction(async tx => {
    let documentId: string;
    let receiptLines: string[];
    if (input.ordenId) {
      await tx.$queryRaw`SELECT id FROM "Orden" WHERE id = ${input.ordenId} FOR UPDATE`;
      const order = await tx.orden.findUnique({ where: { id: input.ordenId }, include: { historial: { orderBy: { createdAt: 'asc' } } } });
      if (!order || order.tipoOperacion !== 'CONSUMO_EMPLEADO') throw new AccountError('Consumo no encontrado', 404);
      const ownMovement = actor.rol === 'admin' || order.creadorId === actor.id || order.empleadoId === actor.id ? true : await tx.movimientoCuentaEmpleado.findFirst({ where: { ordenId: order.id, empleadoId: actor.id }, select: { id: true } });
      if (!ownMovement) throw new AccountError('No puedes imprimir este consumo', 403);
      if (order.estado !== 'entregada') throw new AccountError('El consumo aún no fue entregado', 409);
      const receipt = order.historial.map(h => h.datosDespues as { receiptLines?: unknown } | null).find(h => Array.isArray(h?.receiptLines));
      if (!receipt || !Array.isArray(receipt.receiptLines)) throw new AccountError('El comprobante original no está disponible', 409);
      receiptLines = receipt.receiptLines as string[];
      documentId = `consumo:${order.id}`;
    } else {
      if (!input.empleadoId || !input.liquidacionId) throw new AccountError('Comprobante inválido');
      if (actor.rol !== 'admin' && actor.id !== input.empleadoId) throw new AccountError('No puedes imprimir esta liquidación', 403);
      await lockEmployeeAccount(tx, input.empleadoId, false);
      await tx.$queryRaw`SELECT id FROM "LiquidacionEmpleado" WHERE id = ${input.liquidacionId} FOR UPDATE`;
      const settlement = await tx.liquidacionEmpleado.findFirst({ where: { id: input.liquidacionId, empleadoId: input.empleadoId } });
      if (!settlement) throw new AccountError('Liquidación no encontrada', 404);
      documentId = settlement.id;
      receiptLines = buildEmployeeSettlementLines(settlement);
      const reversed = await tx.movimientoCuentaEmpleado.findFirst({ where: { liquidacionId: settlement.id, tipo: 'REVERSO_LIQUIDACION' } });
      if (reversed) receiptLines = ['DESCUENTO REVERTIDO - VER HISTORIAL', ...receiptLines];
    }
    const copyLines = ['COPIA DEL COMPROBANTE ORIGINAL', 'NO REGISTRA OTRO MOVIMIENTO', ...receiptLines];
    const mode = employeeReceiptMode();
    if (mode === 'disabled') throw new AccountError('No hay un mecanismo de impresión activo', 409);
    const latest = await tx.printJob.findFirst({ where: { type: 'EMPLOYEE_RECEIPT', dedupeKey: { startsWith: `${documentId}:EMPLOYEE_RECEIPT:` } }, orderBy: { revision: 'desc' } });
    if (mode === 'queue' && latest && ['PENDING', 'RETRY', 'PROCESSING'].includes(latest.status)) return { documentId, lines: copyLines, job: latest };
    const job = await enqueueEmployeeReceipt(tx, { documentId, ordenId: input.ordenId, liquidacionId: input.liquidacionId, lines: copyLines, revision: latest ? latest.revision + 1 : 1 });
    return { documentId, lines: copyLines, job };
  });
  if (result.job) return { impresionEnCola: true, estadoImpresion: result.job.status, impresionEnviada: false, impresionError: null };
  return await sendEmployeeReceiptAfterCommit(result);
}
