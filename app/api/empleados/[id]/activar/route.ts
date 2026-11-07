import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/session';
import { AccountError, appendEmployeeMovement, lockEmployeeAccount, requestHash } from '@/lib/employee-account';
import { AccountValidationError, moneyCents, requiredText } from '@/lib/employee-account-validation';
import { CATEGORIA_ADELANTO } from '@/types/retiro';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthenticatedUser();
  if (!actor) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  if (actor.rol !== 'admin') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AccountValidationError('El cuerpo de la petición es inválido');
    const key = requiredText(body.clientRequestId, 'El identificador');
    const razon = requiredText(body.razon, 'La razón');
    if (!Array.isArray(body.expectedRetiros) || !Array.isArray(body.adelantos)) throw new AccountError('Revisión de adelantos inválida');
    const expected: { id: string; updatedAt: string; estado: string }[] = body.expectedRetiros.map((r: { id: unknown; updatedAt: unknown; estado: unknown }) => {
      const id = requiredText(r?.id, 'Retiro');
      const updatedAt = requiredText(r?.updatedAt, 'Versión del retiro');
      const date = new Date(updatedAt);
      if (Number.isNaN(date.getTime()) || date.toISOString() !== updatedAt) throw new AccountError('Versión del retiro inválida');
      const estado = requiredText(r?.estado, 'Estado del retiro');
      if (!['registrado', 'anulado'].includes(estado)) throw new AccountError('Estado del retiro inválido');
      return { id, updatedAt, estado };
    });
    if (new Set(expected.map((r) => r.id)).size !== expected.length) throw new AccountError('Retiro repetido');
    const entries: { retiroId: string; cents: number }[] = body.adelantos.map((a: { retiroId: unknown; pendiente: unknown } | null) => ({ retiroId: requiredText(a?.retiroId, 'Retiro'), cents: moneyCents(a?.pendiente, true) }));
    if (new Set(entries.map((e) => e.retiroId)).size !== entries.length) throw new AccountError('Retiro repetido');
    const hash = requestHash({ id, razon, expectedRetiros: [...expected].sort((a,b) => a.id.localeCompare(b.id)), adelantos: [...entries].sort((a,b) => a.retiroId.localeCompare(b.retiroId)) });
    const result = await prisma.$transaction(async (tx) => {
      const employee = await lockEmployeeAccount(tx, id, false);
      if (employee.cuentaActivadaAt) {
        const opening = employee.aperturaCuenta as { clientRequestId?: string; requestHash?: string } | null;
        if (opening?.clientRequestId === key && opening.requestHash === hash) return opening;
        throw new AccountError('La cuenta ya fue activada o el identificador tiene otros datos', 409);
      }
      const retiros = await tx.retiroCaja.findMany({ where: { beneficiarioId: id, categoria: CATEGORIA_ADELANTO }, orderBy: { id: 'asc' } });
      if (JSON.stringify(retiros.map((r) => ({ id: r.id, updatedAt: r.updatedAt.toISOString(), estado: r.estado })).sort((a,b) => a.id.localeCompare(b.id))) !== JSON.stringify([...expected].sort((a,b) => a.id.localeCompare(b.id)))) throw new AccountError('Los adelantos cambiaron; vuelve a revisar la apertura', 409);
      if (entries.length !== retiros.length || entries.some((e) => !retiros.some((r) => r.id === e.retiroId))) throw new AccountError('Debe confirmar todos los adelantos revisados');
      const detalle = retiros.map((r) => {
        const pending = entries.find((e) => e.retiroId === r.id)!.cents;
        const original = r.monto.mul(100).toNumber();
        if (pending > original || (r.estado !== 'registrado' && pending !== 0)) throw new AccountError('Pendiente inválido para el adelanto');
        return { retiroId: r.id, estado: r.estado, montoOriginal: original / 100, pendiente: pending / 100, descontadoAnteriormente: r.estado === 'registrado' ? (original - pending) / 100 : 0, fecha: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), motivo: r.motivo, beneficiarioNombre: r.beneficiarioNombre };
      });
      const opening = { version: 1, clientRequestId: key, requestHash: hash, autor: actor, razon, fecha: new Date().toISOString(), detalle, limitacion: 'La anulación posterior solo revierte el pendiente importado; la devolución de importes descontados anteriormente requiere una corrección administrativa documentada.' };
      await tx.usuario.update({ where: { id }, data: { cuentaActivadaAt: new Date(), aperturaCuenta: opening as unknown as Prisma.InputJsonValue } });
      for (const item of detalle.filter((x) => x.pendiente > 0)) await appendEmployeeMovement(tx, { empleadoId: id, tipo: 'APERTURA', monto: item.pendiente, motivo: razon, autor: actor, origenClave: `retiro:${item.retiroId}`, idempotencyKey: `apertura:${item.retiroId}`, retiroId: item.retiroId, detalle: item, requireActive: false });
      return opening;
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AccountError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof AccountValidationError || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Error al activar cuenta:', error); return NextResponse.json({ error: 'Error al activar la cuenta' }, { status: 500 });
  }
}
