import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { calcularRecargoEnvases, esNivelPicante } from '../types/orden';
import { hasOnlyConsumptionActionFields, remainingConsumptionQuantities } from './employee-consumption-validation';

assert.deepEqual(remainingConsumptionQuantities(4, true, [
  { cantidad: 1, devolverEnvase: false },
  { cantidad: 2, devolverEnvase: true },
]), { quantity: 1, containers: 2 });
assert.deepEqual(remainingConsumptionQuantities(2, false, [
  { cantidad: 1, devolverEnvase: false },
]), { quantity: 1, containers: 0 });
assert.equal(hasOnlyConsumptionActionFields('entregar', { clientRequestId: 'k', expectedRevision: 0, nuevoEmpleadoId: 'otro' }), false);
assert.equal(hasOnlyConsumptionActionFields('anular', { clientRequestId: 'k', razon: 'error', reponerStock: true, items: [] }), false);
assert.equal(hasOnlyConsumptionActionFields('corregir', { clientRequestId: 'k', razon: 'error', items: [] }), true);
const recargo = calcularRecargoEnvases('para_llevar', [
  { categoria: 'Bebida', cantidad: 2 },
  { categoria: 'Combo', cantidad: 1 },
]);
assert.equal(recargo, 1.25);
assert.equal(new Prisma.Decimal('0.75').mul(2).add(new Prisma.Decimal(4)).add(recargo).toString(), '6.75');
assert.equal(new Prisma.Decimal(30).add('6.75').toString(), '36.75');
assert.equal(calcularRecargoEnvases('local', [{ categoria: 'Combo', cantidad: 3 }]), 0);
assert.equal(calcularRecargoEnvases('para_llevar', [{ categoria: 'Combo', cantidad: 3 }]), 3.75);
assert.equal(calcularRecargoEnvases('para_llevar', [{ categoria: 'Bebida', cantidad: 3 }]), 0);
assert.equal(esNivelPicante('natural'), true);
assert.equal(esNivelPicante('picante_1'), true);
assert.equal(esNivelPicante('invalid'), false);
console.log('employee consumption validation checks passed');
