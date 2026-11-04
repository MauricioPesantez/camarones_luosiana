import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { accountBalance, appendEmployeeMovement, AccountError, type AccountTx } from './employee-account';

async function main() {
  let revision = 0;
  let active = true;
  const amounts: Prisma.Decimal[] = [];
  const tx = {
    $queryRaw: async () => [{ id: 'e1' }],
    usuario: {
      findUniqueOrThrow: async () => ({ id: 'e1', nombre: 'Ana', activo: active, cuentaActivadaAt: new Date(), cuentaRevision: revision }),
      update: async ({ data }: { data: { cuentaRevision: number } }) => { revision = data.cuentaRevision; },
    },
    movimientoCuentaEmpleado: {
      aggregate: async () => ({ _sum: { monto: amounts.reduce((a, b) => a.plus(b), new Prisma.Decimal(0)) } }),
      create: async ({ data }: { data: { monto: Prisma.Decimal; secuencia: number } }) => { amounts.push(data.monto); return data; },
    },
  } as unknown as AccountTx;
  const common = { empleadoId: 'e1', motivo: 'Prueba', autor: { id: 'admin', nombre: 'Admin', rol: 'admin' } };
  await appendEmployeeMovement(tx, { ...common, tipo: 'ADELANTO', monto: '30.00', origenClave: 'r1', idempotencyKey: 'r1' });
  await appendEmployeeMovement(tx, { ...common, tipo: 'CONSUMO', monto: '6.75', origenClave: 'o1', idempotencyKey: 'o1' });
  assert.equal((await accountBalance(tx, 'e1')).saldo, 36.75);
  await appendEmployeeMovement(tx, { ...common, tipo: 'DESCUENTO_SUELDO', monto: '-20.00', origenClave: 'l1', idempotencyKey: 'l1' });
  assert.equal((await accountBalance(tx, 'e1')).pendiente, 16.75);
  active = false;
  await assert.rejects(() => appendEmployeeMovement(tx, { ...common, tipo: 'CONSUMO', monto: 1, origenClave: 'o2', idempotencyKey: 'o2' }), AccountError);
  await appendEmployeeMovement(tx, { ...common, tipo: 'REVERSO_ADELANTO', monto: '-30.00', origenClave: 'rr1', idempotencyKey: 'rr1', requireActive: false });
  assert.equal((await accountBalance(tx, 'e1')).saldoAFavor, 13.25);
  assert.equal(revision, 4);
  await assert.rejects(() => appendEmployeeMovement(tx, { ...common, tipo: 'CONSUMO', monto: 0.001, origenClave: 'x', idempotencyKey: 'x', requireActive: false }), AccountError);
  assert.equal(revision, 4);
  await assert.rejects(() => appendEmployeeMovement(tx, { ...common, tipo: 'CONSUMO', monto: '100000000.00', origenClave: 'limite', idempotencyKey: 'limite', requireActive: false }), AccountError);
  assert.equal(revision, 4);
  await assert.rejects(() => appendEmployeeMovement(tx, { ...common, tipo: 'CONSUMO', monto: -1, origenClave: 'signo', idempotencyKey: 'signo', requireActive: false }), AccountError);
  await assert.rejects(() => appendEmployeeMovement(tx, { ...common, tipo: 'MULTA', monto: 1, origenClave: 'tipo', idempotencyKey: 'tipo', requireActive: false }), AccountError);
  assert.equal(revision, 4);
}
main().then(() => console.log('employee account tests passed')).catch((error) => { console.error(error); process.exitCode = 1; });
