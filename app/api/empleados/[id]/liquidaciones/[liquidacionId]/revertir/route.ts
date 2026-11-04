import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AccountError, appendEmployeeMovement, lockEmployeeAccount, requestHash } from '@/lib/employee-account';
import { AccountValidationError, requiredText } from '@/lib/employee-account-validation';
import { buildEmployeeSettlementLines, enqueueEmployeeReceipt, sendEmployeeReceiptAfterCommit } from '@/lib/employee-print';

function receiptLines(text: string): string[] {
  const clean = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, ' ');
  return clean.match(/.{1,42}/g) ?? [''];
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string; liquidacionId: string }> }) {
  const actor = await getAuthenticatedUser();
  if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  if (actor.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  try {
    const { id, liquidacionId } = await params;
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AccountValidationError('El cuerpo de la petición es inválido');
    const key = requiredText(body.clientRequestId, 'El identificador');
    const razon = requiredText(body.razon, 'La razón');
    const hash = requestHash({ id, liquidacionId, razon });
    const outcome = await prisma.$transaction(async (tx) => {
      await lockEmployeeAccount(tx, id, false);
      const original = await tx.movimientoCuentaEmpleado.findFirst({ where: { empleadoId: id, liquidacionId, tipo: 'DESCUENTO_SUELDO' } });
      if (!original) throw new AccountError('Liquidación no encontrada', 404);
      const priorKey = await tx.movimientoCuentaEmpleado.findUnique({ where: { idempotencyKey: `reverso-liquidacion:${key}` } });
      if (priorKey) {
        if (priorKey.requestHash !== hash) throw new AccountError('El identificador ya fue utilizado con otros datos', 409);
        return { movimiento: priorKey, created: false, lines: [] as string[] };
      }
      const prior = await tx.movimientoCuentaEmpleado.findUnique({ where: { origenClave: `reverso-liquidacion:${liquidacionId}` } });
      if (prior) throw new AccountError('La liquidación ya fue revertida', 409);
      const liquidacion = await tx.liquidacionEmpleado.findFirst({ where: { id: liquidacionId, empleadoId: id } });
      if (!liquidacion) throw new AccountError('Liquidación no encontrada', 404);
      const movimiento = await appendEmployeeMovement(tx, { empleadoId: id, tipo: 'REVERSO_LIQUIDACION', monto: original.monto.negated(), motivo: razon, autor: actor, origenClave: `reverso-liquidacion:${liquidacionId}`, idempotencyKey: `reverso-liquidacion:${key}`, requestHash: hash, liquidacionId, movimientoOrigenId: original.id, requireActive: false });
      const lines = [
        'REVERSO DE DESCUENTO DE SUELDO',
        ...receiptLines(`Liquidacion original: ${liquidacion.id}`),
        ...receiptLines(`Empleado: ${liquidacion.empleadoNombre}`),
        ...receiptLines(`Monto restituido: $${movimiento.monto.toFixed(2)}`),
        ...receiptLines(`Motivo: ${razon}`),
        ...receiptLines(`Fecha registro: ${movimiento.createdAt.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`),
        ...receiptLines(`Registrado por: ${actor.nombre}`),
        'DOCUMENTO ORIGINAL (INMUTABLE)',
        ...buildEmployeeSettlementLines(liquidacion),
      ];
      await tx.printJob.updateMany({
        where: { liquidacionId, type: 'EMPLOYEE_RECEIPT', dedupeKey: { startsWith: `${liquidacionId}:EMPLOYEE_RECEIPT:` }, status: { in: ['PENDING', 'RETRY', 'NEEDS_REVIEW', 'FAILED', 'PROCESSING'] } },
        data: { status: 'DISCARDED', reviewedAt: new Date(), reviewedBy: actor.nombre, reviewReason: 'Liquidación revertida' },
      });
      await enqueueEmployeeReceipt(tx, { documentId: `reverso-liquidacion:${liquidacionId}`, liquidacionId, lines });
      return { movimiento, created: true, lines };
    });
    const impresion = outcome.created ? await sendEmployeeReceiptAfterCommit({ documentId: `reverso-liquidacion:${liquidacionId}`, lines: outcome.lines }) : { impresionEnCola: false, impresionEnviada: false, impresionError: null };
    return NextResponse.json({ ...outcome.movimiento, ...impresion });
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'Operación duplicada; vuelve a intentar' }, { status: 409 });
    if (error instanceof AccountValidationError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error al revertir descuento:', error); return NextResponse.json({ error: 'Error al revertir descuento' }, { status: 500 });
  }
}
