import assert from 'node:assert/strict';
import { accountTotals, moneyCents } from './employee-account-validation';

assert.equal(moneyCents(18.35), 1835);
assert.equal(moneyCents(37840625.09), 3784062509);
assert.equal(moneyCents(0, true), 0);
for (const value of [0, -1, 1.001, NaN, Infinity, '2', 100000000]) assert.throws(() => moneyCents(value));
assert.deepEqual(accountTotals(3675 - 2000 + 200), { saldo: 18.75, pendiente: 18.75, saldoAFavor: 0 });
assert.deepEqual(accountTotals(-750), { saldo: -7.5, pendiente: 0, saldoAFavor: 7.5 });
console.log('employee account validation: ok');
