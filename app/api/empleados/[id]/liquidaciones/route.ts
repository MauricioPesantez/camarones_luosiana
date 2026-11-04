import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AccountError, accountBalance, appendEmployeeMovement, lockEmployeeAccount, requestHash } from '@/lib/employee-account';
import { AccountValidationError, moneyCents, requiredText } from '@/lib/employee-account-validation';
import { buildEmployeeSettlementLines, enqueueEmployeeReceipt, sendEmployeeReceiptAfterCommit } from '@/lib/employee-print';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthenticatedUser();
  if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  if (actor.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AccountValidationError('El cuerpo de la petición es inválido');
    const key = requiredText(body.clientRequestId, 'El identificador');
    const cents = moneyCents(body.monto);
    if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 0) throw new AccountError('Revisión inválida');
    const fecha = requiredText(body.fechaDescuento, 'La fecha');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new AccountError('Fecha inválida');
    const date = new Date(`${fecha}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== fecha) throw new AccountError('Fecha inválida');
    const hash = requestHash({ id, cents, fecha, expectedRevision: body.expectedRevision });
    const outcome = await prisma.$transaction(async (tx) => {
      const empleado = await lockEmployeeAccount(tx, id, false);
      const previous = await tx.liquidacionEmpleado.findUnique({ where: { idempotencyKey: key } });
      if (previous) {
        if (previous.empleadoId !== id || previous.requestHash !== hash) throw new AccountError('El identificador ya fue utilizado con otros datos', 409);
        return { liquidacion: previous, created: false };
      }
      if (!empleado.cuentaActivadaAt) throw new AccountError('La cuenta no está activada', 409);
      if (empleado.cuentaRevision !== body.expectedRevision) throw new AccountError('La cuenta cambió; revisa el saldo antes de confirmar', 409);
      const balance = await accountBalance(tx, id);
      if (new Prisma.Decimal(cents).greaterThan(balance.decimal.mul(100))) throw new AccountError('El descuento supera el saldo pendiente', 409);
      const anterior = await tx.liquidacionEmpleado.findFirst({ where: { empleadoId: id }, orderBy: { corteSecuencia: 'desc' } });
      // El movimiento del cierre anterior ocupa corteSecuencia + 1; su efecto
      // ya está incluido en saldoPosterior y no debe sumarse otra vez.
      const movimientos = await tx.movimientoCuentaEmpleado.findMany({ where: { empleadoId: id, secuencia: { gt: anterior ? anterior.corteSecuencia + 1 : 0, lte: empleado.cuentaRevision } }, orderBy: { secuencia: 'asc' } });
      const snapshot = JSON.parse(JSON.stringify({ version: 1, empleado: { id, nombre: empleado.nombre }, autor: actor, fechaDescuento: fecha, corteSecuencia: empleado.cuentaRevision, liquidacionAnteriorId: anterior?.id ?? null, saldoArrastrado: anterior?.saldoPosterior.toNumber() ?? 0, saldoAnterior: balance.saldo, montoAplicado: cents / 100, saldoPosterior: balance.decimal.minus(new Prisma.Decimal(cents).div(100)).toNumber(), movimientos }));
      const result = await tx.liquidacionEmpleado.create({ data: { empleadoId: id, empleadoNombre: empleado.nombre, autorId: actor.id, autorNombre: actor.nombre, autorRol: actor.rol, fechaDescuento: date, saldoAnterior: balance.decimal, montoAplicado: new Prisma.Decimal(cents).div(100), saldoPosterior: balance.decimal.minus(new Prisma.Decimal(cents).div(100)), corteSecuencia: empleado.cuentaRevision, snapshot, idempotencyKey: key, requestHash: hash } });
      await appendEmployeeMovement(tx, { empleadoId: id, tipo: 'DESCUENTO_SUELDO', monto: new Prisma.Decimal(cents).div(-100), motivo: 'Descuento de sueldo', autor: actor, origenClave: `liquidacion:${result.id}`, idempotencyKey: `liquidacion:${key}`, liquidacionId: result.id, fechaHecho: date, requireActive: false });
      await enqueueEmployeeReceipt(tx, { documentId: result.id, liquidacionId: result.id, lines: buildEmployeeSettlementLines(result) });
      return { liquidacion: result, created: true };
    });
    const impresion = outcome.created ? await sendEmployeeReceiptAfterCommit({ documentId: outcome.liquidacion.id, lines: buildEmployeeSettlementLines(outcome.liquidacion) }) : { impresionEnviada: false, impresionError: null };
    return NextResponse.json({ ...outcome.liquidacion, ...impresion }, { status: outcome.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'El identificador ya fue utilizado; vuelve a intentar' }, { status: 409 });
    if (error instanceof AccountValidationError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error al registrar descuento:', error); return NextResponse.json({ error: 'Error al registrar descuento' }, { status: 500 });
  }
}
