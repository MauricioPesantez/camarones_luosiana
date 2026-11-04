import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { accountTotals } from './employee-account-validation';

export class AccountError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type AccountTx = Prisma.TransactionClient;
export type AccountActor = { id: string; nombre: string; rol: string };
export function requestHash(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

/** All writers lock Usuario first; cash operations lock cash before this row. */
export async function lockEmployeeAccount(tx: AccountTx, id: string, requireActive = true) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Usuario" WHERE id = ${id} FOR UPDATE`;
  if (!rows.length) throw new AccountError('Empleado no encontrado', 404);
  const empleado = await tx.usuario.findUniqueOrThrow({ where: { id } });
  if (requireActive && !empleado.activo) throw new AccountError('El empleado está inactivo', 409);
  if (requireActive && !empleado.cuentaActivadaAt) throw new AccountError('El administrador debe completar la apertura de la cuenta', 409);
  return empleado;
}

export async function accountBalance(tx: AccountTx, empleadoId: string) {
  const sum = await tx.movimientoCuentaEmpleado.aggregate({ where: { empleadoId }, _sum: { monto: true } });
  const decimal = sum._sum.monto ?? new Prisma.Decimal(0);
  return { decimal, ...accountTotals(decimal.mul(100).toNumber()) };
}

type MovementInput = {
  empleadoId: string; tipo: string; monto: Prisma.Decimal | number | string; motivo: string; autor: AccountActor;
  origenClave: string; idempotencyKey: string; requestHash?: string; retiroId?: string; ordenId?: string;
  liquidacionId?: string; movimientoOrigenId?: string; detalle?: Prisma.InputJsonValue; fechaHecho?: Date;
  requireActive?: boolean;
};
/** Locks and increments the same employee revision for every financial event. */
export async function appendEmployeeMovement(tx: AccountTx, input: MovementInput) {
  const employee = await lockEmployeeAccount(tx, input.empleadoId, input.requireActive !== false);
  const monto = new Prisma.Decimal(input.monto);
  if (!monto.isFinite() || monto.isZero() || !monto.mul(100).isInteger() || monto.abs().greaterThan('99999999.99')) throw new AccountError('El movimiento debe tener un monto exacto y estar dentro del límite permitido');
  const cargo = ['APERTURA', 'ADELANTO', 'CONSUMO', 'REVERSO_LIQUIDACION'].includes(input.tipo);
  const abono = ['DESCUENTO_SUELDO', 'REVERSO_ADELANTO', 'REVERSO_CONSUMO'].includes(input.tipo);
  if ((!cargo && !abono) || (cargo && monto.isNegative()) || (abono && monto.isPositive())) throw new AccountError('El tipo y el signo del movimiento no coinciden');
  const saldoActual = await accountBalance(tx, employee.id);
  if (saldoActual.decimal.plus(monto).abs().greaterThan('99999999.99')) throw new AccountError('El saldo supera el límite permitido', 409);
  const revision = employee.cuentaRevision + 1;
  await tx.usuario.update({ where: { id: employee.id }, data: { cuentaRevision: revision } });
  return tx.movimientoCuentaEmpleado.create({ data: {
    empleadoId: employee.id, empleadoNombre: employee.nombre, secuencia: revision,
    tipo: input.tipo, monto, motivo: input.motivo, autorId: input.autor.id, autorNombre: input.autor.nombre,
    autorRol: input.autor.rol, origenClave: input.origenClave, idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash, retiroId: input.retiroId, ordenId: input.ordenId,
    liquidacionId: input.liquidacionId, movimientoOrigenId: input.movimientoOrigenId,
    detalle: input.detalle, fechaHecho: input.fechaHecho,
  } });
}
