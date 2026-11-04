/* eslint-disable @typescript-eslint/no-require-imports -- Transpiled service with isolated transaction doubles; PostgreSQL verifies real locks separately. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { transpileModule, ModuleKind, ScriptTarget } = require('typescript');
const { Prisma } = require('@prisma/client');
require('ts-node').register({ compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const validation = require('./employee-consumption-validation.ts');
const orderTypes = require('../types/orden.ts');
class AccountError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const admin = { id: 'admin', nombre: 'Admin', rol: 'admin' };
let actors, products, order, history, movements, failure, dailyCounter, lockEvents, printCalls;
const amount = n => new Prisma.Decimal(n);
function reset() {
  actors = Object.fromEntries(['a', 'b'].map((id, index) => [id, { id, nombre: index ? 'Beto' : 'Ana', activo: true, cuentaActivadaAt: new Date(), cuentaRevision: 0 }]));
  products = [
    { id: 'p', nombre: 'Combo', categoria: 'Combo', precio: amount(5), precioEmpleado: amount(4), disponible: true, stock: 5, requierePreparacionEmpleado: true },
    { id: 'cola', nombre: 'Cola', categoria: 'Bebida', precio: amount(1), precioEmpleado: amount('0.75'), disponible: true, stock: 5, requierePreparacionEmpleado: false },
  ];
  order = null; history = []; movements = []; failure = null; dailyCounter = 0; lockEvents = []; printCalls = 0;
}
async function lockEmployeeAccount(_tx, id, requireActive = true) {
  const actor = actors[id];
  if (!actor) throw new AccountError('Empleado no encontrado', 404);
  if (requireActive && !actor.activo) throw new AccountError('El empleado está inactivo', 409);
  if (requireActive && !actor.cuentaActivadaAt) throw new AccountError('El administrador debe completar la apertura de la cuenta', 409);
  return actor;
}
const tx = {
  $executeRaw: async () => 1,
  $queryRaw: async query => { if (query.join('').includes('Producto')) lockEvents.push('product'); return [{ id: order?.id ?? 'p' }]; },
  producto: {
    findMany: async ({ where }) => products.filter(p => where.id.in.includes(p.id)),
    updateMany: async ({ where, data }) => { const p = products.find(p => p.id === where.id); if (p.stock < where.stock.gte) return { count: 0 }; p.stock -= data.stock.decrement; return { count: 1 }; },
    update: async ({ where, data }) => { products.find(p => p.id === where.id).stock += data.stock.increment; },
  },
  orden: {
    findUnique: async ({ where }) => order && ((where.id && where.id === order.id) || (where.consumoRequestId && where.consumoRequestId === order.consumoRequestId)) ? order : null,
    findUniqueOrThrow: async () => ({ ...order, historial: [...history] }),
    create: async ({ data }) => {
      if (failure === 'order') throw new Error('simulated order failure');
      order = { cobrada: false, montoPagado: amount(0), ...data, id: 'o1', anulada: false, printRevision: 0, items: data.items.create.map((item, index) => ({ ...item, id: `i${index}`, producto: products.find(p => p.id === item.productoId) })) };
      return order;
    },
    update: async ({ data }) => { order = { ...order, ...data, printRevision: order.printRevision + (data.printRevision?.increment ?? 0) }; return order; },
  },
  historialOrden: {
    findFirst: async ({ where }) => history.find(h => h.datosDespues?.requestKey === where.datosDespues.equals) ?? null,
    create: async ({ data }) => { if (failure === 'history') throw new Error('simulated history failure'); history.push(data); return data; },
  },
  movimientoCuentaEmpleado: { findFirst: async ({ where }) => [...movements].reverse().find(m => m.ordenId === where.ordenId && m.empleadoId === where.empleadoId && m.tipo === where.tipo) ?? null },
  usuario: { findUniqueOrThrow: async ({ where }) => actors[where.id] },
  printJob: { updateMany: async () => ({ count: 0 }) },
};
const prisma = { $transaction: async fn => {
  const before = { stock: products.map(p => p.stock), order, history: [...history], movements: [...movements], dailyCounter };
  try { return await fn(tx); }
  catch (error) { products.forEach((p, i) => { p.stock = before.stock[i]; }); dailyCounter = before.dailyCounter; order = before.order; history = before.history; movements = before.movements; throw error; }
} };
const dependencies = {
  '@prisma/client': { Prisma }, '@/lib/db': { prisma },
  '@/lib/employee-account': {
    AccountError, requestHash: value => createHash('sha256').update(JSON.stringify(value)).digest('hex'), lockEmployeeAccount,
    appendEmployeeMovement: async (_tx, data) => { await lockEmployeeAccount(_tx, data.empleadoId, data.requireActive !== false); if (failure === 'movement') throw new Error('simulated movement failure'); const movement = { ...data, id: `m${movements.length}` }; movements.push(movement); return movement; },
  },
  '@/lib/daily-order-number': { allocateDailyOrderNumber: async () => { lockEvents.push('daily'); return { number: ++dailyCounter, dateKey: '2026-11-04' }; } },
  '@/lib/print-jobs': { PRINT_JOB_TYPES: { ORDER: 'ORDER' }, enqueueOrderPrintJob: async () => { printCalls++; }, shouldEnqueuePrintJob: () => true },
  '@/lib/employee-print': { buildEmployeeConsumptionLines: o => [`Empleado: ${o.empleadoNombre}`, `Total: ${o.total}`], enqueueEmployeeReceipt: async () => { printCalls++; } },
  '@/lib/employee-consumption-validation': validation, '@/types/orden': orderTypes,
};
const js = transpileModule(readFileSync('lib/employee-consumption.ts', 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', js)(name => { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; }, mod, mod.exports);
const { createConsumption, changeConsumption } = mod.exports;
const body = (key = 'create', items = [{ productoId: 'p', cantidad: 2, nivelPicante: 'natural', precioEsperado: 4 }]) => ({ clientRequestId: key, empleadoId: 'a', tipoOrden: 'para_llevar', items });
const correction = (key = 'return') => ({ clientRequestId: key, razon: 'devolución', items: [{ itemId: 'i0', cantidad: 1, reponerStock: true, devolverEnvase: true }] });
const balance = id => movements.filter(m => m.empleadoId === id).reduce((sum, m) => sum.add(m.monto), amount(0)).toString();
const tests = [];
const test = (name, run) => tests.push({ name, run });

for (const flag of [true, false]) for (const kind of ['drink', 'combo', 'mixed']) test(`delivered ${kind}, legacy preparation=${flag}`, async () => {
  products.forEach(p => { p.requierePreparacionEmpleado = flag; });
  const items = kind === 'drink' ? [{ productoId: 'cola', cantidad: 2, precioEsperado: 0.75 }] : kind === 'combo' ? body().items : [...body().items, { productoId: 'cola', cantidad: 2, precioEsperado: 0.75 }];
  const request = body('create', items);
  const created = await createConsumption(request, admin);
  assert.equal(created.orden.estado, 'entregada');
  assert.equal(created.orden.cobrada, false); assert.equal(created.orden.montoPagado.toString(), '0');
  assert.equal(created.printJobQueued, false);
  assert.equal(movements.length, 1); assert.equal(movements[0].monto.toString(), order.total.toString());
  assert.equal(movements[0].origenClave, 'consumo:o1'); assert.equal(movements[0].idempotencyKey, 'consumo:o1');
  assert.deepEqual(history[0].datosDespues.receiptLines, ['Empleado: Ana', `Total: ${order.total}`]);
  const stocks = products.map(p => p.stock);
  assert.equal((await createConsumption(request, admin)).replay, true);
  assert.deepEqual(products.map(p => p.stock), stocks); assert.equal(movements.length, 1); assert.equal(dailyCounter, 1); assert.equal(history.length, 1);
  assert.equal(printCalls, 0, 'creating and retrying never enqueue any printer document');
  assert.deepEqual(lockEvents, ['daily', ...new Set(items.map(i => i.productoId))].map((x, i) => i ? 'product' : x));
});
test('exact cents, container charge and prior advance', async () => {
  movements.push({ empleadoId: 'a', tipo: 'ADELANTO', monto: amount(30) });
  const result = await createConsumption(body('cents', [{ productoId: 'cola', cantidad: 2, precioEsperado: 0.75 }, { productoId: 'p', cantidad: 1, nivelPicante: 'natural', precioEsperado: 4 }]), admin);
  assert.equal(result.orden.total.toString(), '6.75'); assert.equal(result.orden.recargo, 1.25); assert.equal(balance('a'), '36.75');
  assert.deepEqual(products.map(p => p.stock), [4, 3]);
});
test('same key with changed payload or creator conflicts', async () => {
  await createConsumption(body(), admin);
  await assert.rejects(() => createConsumption({ ...body(), tipoOrden: 'local' }, admin), /clave de solicitud/);
  await assert.rejects(() => createConsumption(body(), { ...admin, id: 'other' }), /clave de solicitud/);
  assert.equal(movements.length, 1); assert.equal(products[0].stock, 3);
});
for (const stage of ['order', 'history', 'movement']) test(`rollback after ${stage} failure`, async () => {
  failure = stage;
  await assert.rejects(() => createConsumption(body(), admin), /simulated/);
  assert.equal(order, null); assert.equal(history.length, 0); assert.equal(movements.length, 0); assert.equal(dailyCounter, 0); assert.deepEqual(products.map(p => p.stock), [5, 5]); assert.equal(printCalls, 0);
});
for (const issue of ['inactive', 'unopened', 'price', 'stock', 'sauce']) test(`reject ${issue} without effects`, async () => {
  let request = body();
  if (issue === 'inactive') actors.a.activo = false;
  if (issue === 'unopened') actors.a.cuentaActivadaAt = null;
  if (issue === 'price') products[0].precioEmpleado = amount('4.01');
  if (issue === 'stock') products[0].stock = 1;
  if (issue === 'sauce') request = body('bad-sauce', [{ ...body().items[0], nivelPicante: 'invalid' }]);
  const stock = products.map(p => p.stock);
  await assert.rejects(() => createConsumption(request, admin), AccountError);
  assert.equal(order, null); assert.equal(history.length, 0); assert.equal(movements.length, 0); assert.deepEqual(products.map(p => p.stock), stock); assert.equal(dailyCounter, 0);
});
test('duplicate product quantities aggregate across sauce variants', async () => {
  products[0].stock = 3;
  await assert.rejects(() => createConsumption(body('aggregate', [body().items[0], { ...body().items[0], nivelPicante: 'picante_1' }]), admin), /Stock/);
  assert.equal(products[0].stock, 3); assert.equal(order, null); assert.equal(movements.length, 0);
});
test('legacy delivery confirms delivered with revision, permissions and idempotency', async () => {
  await createConsumption(body(), admin);
  const existing = { stock: products[0].stock, movements: movements.length, revision: order.printRevision, snapshot: history[0].datosDespues.receiptLines };
  const action = { clientRequestId: 'delivery', expectedRevision: 0 };
  await assert.rejects(() => changeConsumption('o1', 'entregar', { ...action, nuevoEmpleadoId: 'b' }, admin), /campos no permitidos/);
  await assert.rejects(() => changeConsumption('o1', 'entregar', { ...action, expectedRevision: 1 }, admin), /cambi|revisión/i);
  await assert.rejects(() => changeConsumption('o1', 'entregar', action, { id: 'stranger', rol: 'mesero' }), /No autorizado/);
  const result = await changeConsumption('o1', 'entregar', action, admin);
  assert.equal(result.orden.estado, 'entregada'); assert.equal(result.receiptLines, null);
  assert.equal((await changeConsumption('o1', 'entregar', action, admin)).replay, true);
  await assert.rejects(() => changeConsumption('o1', 'entregar', { ...action, expectedRevision: 1 }, admin), /clave de solicitud/);
  assert.equal(products[0].stock, existing.stock); assert.equal(movements.length, existing.movements); assert.equal(order.printRevision, existing.revision); assert.deepEqual(history[0].datosDespues.receiptLines, existing.snapshot); assert.equal(printCalls, 0);
});
for (const state of ['pendiente', 'en_preparacion', 'lista']) test(`legacy ${state} requires regularization and preserves cancellation`, async () => {
  await createConsumption(body(), admin); order.estado = state; movements = []; printCalls = 0;
  await assert.rejects(() => changeConsumption('o1', 'entregar', { clientRequestId: 'legacy', expectedRevision: 0 }, admin), error => error.status === 409 && /regulariza/i.test(error.message));
  assert.equal(order.estado, state); assert.equal(movements.length, 0); assert.equal(products[0].stock, 3); assert.equal(printCalls, 0);
  await changeConsumption('o1', 'anular', { clientRequestId: 'cancel', razon: 'error previo', reponerStock: true }, admin);
  assert.equal(order.anulada, true); assert.equal(products[0].stock, 5); assert.equal(movements.length, 0);
});
for (const regularized of [false, true]) test(`traceable corrections preserve original and closed payroll, regularized=${regularized}`, async () => {
  await createConsumption(body(), admin);
  if (regularized) { history.push({ tipoAccion: 'consumo_regularizado_entregado', datosDespues: { receiptLines: ['Regularizado'] } }); }
  const original = JSON.stringify({ createdAt: order.createdAt, total: order.total, items: order.items.map(item => ({ ...item, producto: undefined })), creation: history[0] });
  const closure = Object.freeze({ empleadoId: 'a', saldoAnterior: '10.50', saldoPosterior: '0', snapshot: 'signed payroll' });
  movements.push({ empleadoId: 'a', tipo: 'DESCUENTO_SUELDO', monto: amount('-10.50'), liquidacionId: 'closed', detalle: closure });
  const closedBefore = JSON.stringify(movements[1]);
  await assert.rejects(() => changeConsumption('o1', 'corregir', correction(), { id: 'waiter', rol: 'mesero' }), /No autorizado/);
  await assert.rejects(() => changeConsumption('o1', 'corregir', { ...correction(), razon: '' }, admin), /razón/);
  await changeConsumption('o1', 'corregir', { clientRequestId: 'transfer', razon: 'beneficiario', nuevoEmpleadoId: 'b' }, admin);
  assert.deepEqual(movements.slice(2).map(m => [m.empleadoId, m.monto.toString()]), [['a', '-10.5'], ['b', '10.5']]);
  const chargeB = movements.pop();
  await assert.rejects(() => changeConsumption('o1', 'corregir', correction(), admin), /Falta el cargo original/);
  movements.push(chargeB);
  await changeConsumption('o1', 'corregir', correction(), admin);
  assert.equal(movements.at(-1).empleadoId, 'b'); assert.equal(movements.at(-1).monto.toString(), '-5.25'); assert.equal(movements.at(-1).movimientoOrigenId, chargeB.id); assert.equal(products[0].stock, 4);
  await changeConsumption('o1', 'corregir', correction(), admin);
  assert.equal(products[0].stock, 4); assert.equal(movements.length, 5);
  await assert.rejects(() => changeConsumption('o1', 'corregir', { ...correction('too-much'), items: [{ ...correction().items[0], cantidad: 2 }] }, admin), /supera/);
  await changeConsumption('o1', 'corregir', { clientRequestId: 'transfer-back', razon: 'beneficiario', nuevoEmpleadoId: 'a' }, admin);
  assert.equal(movements[5].movimientoOrigenId, chargeB.id);
  await changeConsumption('o1', 'corregir', { ...correction('irrecoverable'), items: [{ ...correction().items[0], reponerStock: false }] }, admin);
  assert.equal(movements[7].movimientoOrigenId, movements[6].id); assert.equal(products[0].stock, 4, 'irrecoverable product is never restored');
  assert.equal(balance('a'), '-10.5', 'post-payroll credits can leave a credit balance'); assert.equal(balance('b'), '0');
  assert.equal(JSON.stringify(movements[1]), closedBefore); assert.equal(JSON.stringify({ createdAt: order.createdAt, total: order.total, items: order.items.map(item => ({ ...item, producto: undefined })), creation: history[0] }), original); assert.equal(printCalls, 0);
});
(async () => {
  let failed = 0;
  for (const { name, run } of tests) { reset(); try { await run(); console.log(`ok - ${name}`); } catch (error) { failed++; console.error(`FAIL - ${name}: ${error.stack}`); } }
  if (failed) throw new Error(`${failed}/${tests.length} employee consumption checks failed`);
  console.log(`${tests.length} employee consumption service checks passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
