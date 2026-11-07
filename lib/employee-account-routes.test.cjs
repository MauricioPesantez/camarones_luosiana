/* eslint-disable @typescript-eslint/no-require-imports -- inject dependencies before loading the actual route */
// Run with: TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' node -r ts-node/register/transpile-only lib/employee-account-routes.test.cjs
require('tsconfig-paths').register({ baseUrl: process.cwd(), paths: { '@/*': ['*'] } });
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const D = (v) => new Prisma.Decimal(v);
let state = {
  users: { a: { id: 'a', nombre: 'Ana', activo: true, cuentaActivadaAt: new Date(), cuentaRevision: 1 }, b: { id: 'b', nombre: 'Beto', activo: false, cuentaActivadaAt: new Date(), cuentaRevision: 1 } , c: { id: 'c', nombre: 'Ceci', activo: true, cuentaActivadaAt: null, cuentaRevision: 0 }, d: { id: 'd', nombre: 'Dora', activo: false, cuentaActivadaAt: new Date(), cuentaRevision: 0 }, e: { id: 'e', nombre: 'Elena', activo: false, cuentaActivadaAt: null, cuentaRevision: 0 } },
  retiros: [{ id: 'r1', beneficiarioId: 'c', categoria: 'adelanto', monto: D(10), estado: 'registrado', motivo: 'Anticipo', beneficiarioNombre: 'Ceci', createdAt: new Date('2026-01-01T12:00:00.000Z'), updatedAt: new Date('2026-01-01T12:00:00.000Z') }, { id: 'r2', beneficiarioId: 'e', categoria: 'adelanto', monto: D(10), estado: 'registrado', motivo: 'Histórico', beneficiarioNombre: 'Elena', createdAt: new Date('2026-01-01T12:00:00.000Z'), updatedAt: new Date('2026-01-01T12:00:00.000Z') }],
  movements: [{ id: 'm1', empleadoId: 'a', secuencia: 1, tipo: 'ADELANTO', monto: D(30), motivo: 'Adelanto' }, { id: 'm2', empleadoId: 'b', secuencia: 1, tipo: 'ADELANTO', monto: D(10), motivo: 'Adelanto' }],
  settlements: [],
  jobs: [],
};
let actor = { id: 'admin', nombre: 'Admin', rol: 'admin' };
let accountQuery;
let failMovement = false;
let failPrint = false;
let sends = 0;
let lock = Promise.resolve();
function fakeTx(db) {
  return {
    $queryRaw: async (_strings, id) => db.users[id] ? [{ id }] : [],
    usuario: {
      findUniqueOrThrow: async ({ where }) => ({ ...db.users[where.id] }),
      update: async ({ where, data }) => Object.assign(db.users[where.id], data),
    },
    retiroCaja: { findMany: async ({ where }) => db.retiros.filter(r => r.beneficiarioId === where.beneficiarioId && r.categoria === where.categoria).sort((a, b) => a.id.localeCompare(b.id)) },
    printJob: {
      updateMany: async ({ where, data }) => { for (const job of db.jobs) if (job.liquidacionId === where.liquidacionId && job.type === where.type && job.dedupeKey.startsWith(where.dedupeKey.startsWith) && where.status.in.includes(job.status)) Object.assign(job, data); },
      upsert: async ({ create }) => { if (failPrint) throw new Error('simulated queue failure'); db.jobs.push({ ...create, status: 'PENDING' }); },
    },
    movimientoCuentaEmpleado: {
      findFirst: async ({ where }) => db.movements.find(m => m.empleadoId === where.empleadoId && m.liquidacionId === where.liquidacionId && m.tipo === where.tipo) ?? null,
      findUnique: async ({ where }) => db.movements.find(m => where.idempotencyKey ? m.idempotencyKey === where.idempotencyKey : m.origenClave === where.origenClave) ?? null,
      aggregate: async ({ where }) => ({ _sum: { monto: db.movements.filter(m => m.empleadoId === where.empleadoId).reduce((a, m) => a.plus(m.monto), D(0)) } }),
      findMany: async ({ where }) => db.movements.filter(m => m.empleadoId === where.empleadoId && m.secuencia > where.secuencia.gt && m.secuencia <= where.secuencia.lte),
      create: async ({ data }) => { if (failMovement) throw new Error('simulated write failure'); const m = { ...data, id: `m${db.movements.length + 1}`, createdAt: new Date('2026-11-04T12:00:00.000Z') }; db.movements.push(m); return m; },
    },
    liquidacionEmpleado: {
      findUnique: async ({ where }) => db.settlements.find(s => s.idempotencyKey === where.idempotencyKey) || null,
      findFirst: async ({ where }) => db.settlements.filter(s => s.empleadoId === where.empleadoId && (!where.id || s.id === where.id)).sort((a, b) => b.corteSecuencia - a.corteSecuencia)[0] || null,
      create: async ({ data }) => { const s = { ...data, id: `l${db.settlements.length + 1}` }; db.settlements.push(s); return s; },
    },
  };
}
const prisma = {
  usuario: { findMany: async () => Object.values(state.users).map(u => ({ ...u, liquidacionesCuenta: [] })), findUnique: async ({ where }) => state.users[where.id] ?? null },
  movimientoCuentaEmpleado: { groupBy: async () => [], aggregate: async ({ where }) => ({ _sum: { monto: state.movements.filter(m => m.empleadoId === where.empleadoId).reduce((a, m) => a.plus(m.monto), D(0)) } }), findMany: async (args) => { accountQuery = args; return state.movements.filter(m => m.empleadoId === args.where.empleadoId); } },
  orden: { groupBy: async () => [], findMany: async () => [] },
  liquidacionEmpleado: { findMany: async () => [] },
  retiroCaja: { findMany: async () => [] },
  $transaction: async (fn) => {
  const prior = lock; let release; lock = new Promise(r => { release = r; }); await prior;
  const copy = { users: Object.fromEntries(Object.entries(state.users).map(([id, u]) => [id, { ...u }])), retiros: state.retiros.map(r => ({ ...r })), movements: state.movements.map(m => ({ ...m })), settlements: state.settlements.map(s => ({ ...s })), jobs: state.jobs.map(j => ({ ...j })) };
  try { const result = await fn(fakeTx(copy)); state = copy; return result; } finally { release(); }
} };
function stub(path, exports) { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub('./db', { prisma });
stub('./session', { getAuthenticatedUser: async () => actor });
stub('./employee-print', { buildEmployeeSettlementLines: () => ['DOCUMENTO ORIGINAL'], enqueueEmployeeReceipt: async (tx, input) => tx.printJob.upsert({ create: { liquidacionId: input.liquidacionId, type: 'EMPLOYEE_RECEIPT', dedupeKey: `${input.documentId}:EMPLOYEE_RECEIPT:0`, lines: input.lines } }), sendEmployeeReceiptAfterCommit: async () => { sends++; return { impresionEnviada: false, impresionError: null }; } });
const { POST } = require('../app/api/empleados/[id]/liquidaciones/route');
const { POST: activate } = require('../app/api/empleados/[id]/activar/route');
const { POST: reverse } = require('../app/api/empleados/[id]/liquidaciones/[liquidacionId]/revertir/route');
const { GET: listAccounts } = require('../app/api/empleados/cuentas/route');
const { GET: getAccount } = require('../app/api/empleados/[id]/cuenta/route');
const call = (id, body) => POST(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
(async () => {
  const summary = await (await listAccounts()).json();
  assert.ok(summary.empleados.some(employee => employee.id === 'd' && !employee.activo && employee.saldo === 0), 'La cuenta inactiva sin saldo conserva acceso al historial');
  actor = { id: 'a', nombre: 'Ana', rol: 'cocina' };
  const account = (id) => getAccount(new Request('http://localhost/api/empleados/' + id + '/cuenta'), { params: Promise.resolve({ id }) });
  assert.equal((await account('b')).status, 403);
  assert.equal((await account('a')).status, 200);
  assert.deepEqual(accountQuery.where, { empleadoId: 'a' });
  assert.equal(accountQuery.include.orden.select.items.select.nombreProducto, true);
  assert.equal(accountQuery.include.orden.select.items.select.id, true);
  assert.equal(accountQuery.include.retiro.select.createdAt, true);
  assert.equal('empleadoId' in accountQuery.include.orden.select, false, 'No expone al beneficiario actual de un documento reasignado');
  assert.equal('producto' in accountQuery.include.orden.select.items.select, false, 'No expone el catálogo completo desde la cuenta propia');
  actor = { id: 'admin', nombre: 'Admin', rol: 'admin' };
  const body = { clientRequestId: 'one', expectedRevision: 1, monto: 20, fechaDescuento: '2026-11-04' };
  const [first, replay] = await Promise.all([call('a', body), call('a', body)]);
  assert.deepEqual([first.status, replay.status], [201, 200]);
  assert.equal(state.settlements.length, 1);
  assert.equal(state.users.a.cuentaRevision, 2);
  assert.equal((await call('a', { ...body, monto: 19 })).status, 409);
  assert.equal((await call('a', { ...body, clientRequestId: 'stale' })).status, 409);
  assert.equal((await call('a', { ...body, clientRequestId: 'date', expectedRevision: 2, fechaDescuento: '2026-02-30' })).status, 400);
  assert.equal((await call('a', { ...body, clientRequestId: 'excess', expectedRevision: 2, monto: 10.01 })).status, 409);
  failMovement = true;
  const oldError = console.error; console.error = () => {};
  assert.equal((await call('a', { ...body, clientRequestId: 'failure', expectedRevision: 2, monto: 5 })).status, 500);
  console.error = oldError; failMovement = false;
  assert.equal(state.settlements.length, 1); assert.equal(state.users.a.cuentaRevision, 2);
  assert.equal((await call('b', { ...body, clientRequestId: 'inactive', monto: 5 })).status, 201);
  assert.equal(state.users.a.cuentaRevision, 2);
  state.movements.push({ id: 'new', empleadoId: 'a', secuencia: 3, tipo: 'CONSUMO', monto: D(2), motivo: 'Consumo' }); state.users.a.cuentaRevision = 3;
  assert.equal((await call('a', { ...body, clientRequestId: 'second', expectedRevision: 3, monto: 12 })).status, 201);
  const snapshot = state.settlements.find(s => s.idempotencyKey === 'second').snapshot;
  assert.equal(snapshot.saldoArrastrado, 10); assert.equal(snapshot.saldoAnterior, 12);
  assert.deepEqual(snapshot.movimientos.map(m => m.id), ['new']);
  const opening = { clientRequestId: 'open', razon: 'Revisión', expectedRetiros: [{ id: 'r1', updatedAt: '2026-01-01T12:00:00.000Z', estado: 'registrado' }], adelantos: [{ retiroId: 'r1', pendiente: 0 }] };
  const open = (body) => activate(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'c' }) });
  state.retiros[0].estado = 'anulado'; state.retiros[0].updatedAt = new Date('2026-01-02T12:00:00.000Z');
  assert.equal((await open(opening)).status, 409); assert.equal(state.users.c.cuentaActivadaAt, null);
  opening.expectedRetiros[0].updatedAt = '2026-01-02T12:00:00.000Z'; opening.expectedRetiros[0].estado = 'anulado';
  assert.equal((await open(opening)).status, 200); assert.equal(state.users.c.cuentaRevision, 0);
  assert.equal((await open(opening)).status, 200);
  assert.equal((await open({ ...opening, razon: 'Otra revisión' })).status, 409);
  assert.equal(state.movements.filter(m => m.empleadoId === 'c').length, 0);
  const inactiveOpening = { clientRequestId: 'open-inactive', razon: 'Revisión', expectedRetiros: [{ id: 'r2', updatedAt: '2026-01-01T12:00:00.000Z', estado: 'registrado' }], adelantos: [{ retiroId: 'r2', pendiente: 4 }] };
  const inactiveResponse = await activate(new Request('http://localhost', { method: 'POST', body: JSON.stringify(inactiveOpening) }), { params: Promise.resolve({ id: 'e' }) });
  assert.equal(inactiveResponse.status, 200);
  assert.equal(state.users.e.cuentaRevision, 1);
  assert.ok(state.movements.some(m => m.empleadoId === 'e' && m.tipo === 'APERTURA' && m.monto.equals(4)));
  assert.equal((await call('e', { clientRequestId: 'close-inactive', expectedRevision: 1, monto: 4, fechaDescuento: '2026-11-04' })).status, 201);
  const liquidacionId = state.settlements.find(s => s.idempotencyKey === 'close-inactive').id;
  const reversal = { clientRequestId: 'reverse', razon: 'Error de registro' };
  const reverseCall = body => reverse(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'e', liquidacionId }) });
  const sendCount = sends;
  failPrint = true; console.error = () => {};
  assert.equal((await reverseCall(reversal)).status, 500);
  console.error = oldError; failPrint = false;
  assert.equal(state.users.e.cuentaRevision, 2);
  assert.equal(state.jobs.find(j => j.dedupeKey === `${liquidacionId}:EMPLOYEE_RECEIPT:0`).status, 'PENDING', 'Fallo de cola revierte descarte y movimiento');
  assert.equal((await reverseCall(reversal)).status, 200);
  assert.equal(state.jobs.find(j => j.dedupeKey === `${liquidacionId}:EMPLOYEE_RECEIPT:0`).status, 'DISCARDED');
  const reverseJob = state.jobs.find(j => j.dedupeKey === `reverso-liquidacion:${liquidacionId}:EMPLOYEE_RECEIPT:0`);
  assert.ok(reverseJob.lines.includes('REVERSO DE DESCUENTO DE SUELDO'));
  assert.ok(reverseJob.lines.includes('DOCUMENTO ORIGINAL'));
  assert.equal(state.users.e.cuentaRevision, 3);
  assert.equal(sends, sendCount + 1);
  assert.equal((await reverseCall(reversal)).status, 200);
  assert.equal(sends, sendCount + 1, 'Un reintento no vuelve a imprimir');
  assert.equal((await reverseCall({ ...reversal, razon: 'Otro motivo' })).status, 409);
  assert.equal((await reverseCall({ ...reversal, clientRequestId: 'otra-clave' })).status, 409);
  assert.equal(state.jobs.filter(j => j.dedupeKey === reverseJob.dedupeKey).length, 1);
  console.log('employee account route transaction tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
