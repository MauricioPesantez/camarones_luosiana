/* Integration tests require an explicitly isolated PostgreSQL database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as accounts from './employee-account';
import * as accountValidation from './employee-account-validation';
import * as daily from './daily-order-number';
import * as printing from './employee-print';
import * as validation from './employee-consumption-validation';
import * as orderTypes from '../types/orden';
import { claimNextPrintJob } from './print-agent-jobs';

const testUrl = process.env.EMPLOYEE_TEST_DATABASE_URL;
if (!testUrl) throw new Error('Defina EMPLOYEE_TEST_DATABASE_URL para una base PostgreSQL de pruebas; no se usa DATABASE_URL.');
const url = new URL(testUrl);
if (!/^postgres(ql)?:$/.test(url.protocol) || !/test/i.test(url.pathname) || testUrl === process.env.DATABASE_URL) {
  throw new Error('EMPLOYEE_TEST_DATABASE_URL debe identificar una base de pruebas distinta de DATABASE_URL.');
}
const schema = `employee_test_${randomUUID().replaceAll('-', '')}`;
url.searchParams.set('schema', schema);
// Igual que Neon: el SQL crudo compara columnas sin zona con parámetros Date.
url.searchParams.set('options', '-c timezone=UTC');
const isolatedUrl = url.toString();
const prisma = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
const requireFromHere = createRequire(__filename);
function load<T>(file: string, dependencies: Record<string, unknown>): T {
  const source = transpileModule(readFileSync(resolve(file), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (name: string) => name in dependencies ? dependencies[name] : requireFromHere(name), loaded, loaded.exports,
  );
  return loaded.exports as T;
}
const dependencies = {
  '@/lib/db': { prisma }, '@/lib/employee-account': accounts,
  '@/lib/daily-order-number': daily, '@/lib/employee-print': printing,
  '@/lib/employee-consumption-validation': validation, '@/types/orden': orderTypes,
};
const consumption = load<typeof import('./employee-consumption')>('lib/employee-consumption.ts', dependencies);
const actor = { id: 'test-admin', nombre: 'Administrador de prueba', rol: 'admin' as const };

async function legacyFixture(state = 'pendiente') {
  const f = await fixture();
  const order = await prisma.orden.create({ data: {
    tipoOperacion: 'CONSUMO_EMPLEADO', empleadoId: f.employee.id, empleadoNombre: f.employee.nombre,
    consumoRequestId: randomUUID(), tipoOrden: 'para_llevar', estado: state, total: '6.75', recargo: '1.25',
    mesero: actor.nombre, creadorId: actor.id, creadorRol: actor.rol, createdAt: new Date('2026-10-01T12:00:00Z'),
    items: { create: [
      { productoId: f.cola.id, nombreProducto: f.cola.nombre, cantidad: 2, precioUnitario: '.75', subtotal: '1.5' },
      { productoId: f.combo.id, nombreProducto: f.combo.nombre, cantidad: 1, precioUnitario: '4', subtotal: '4', nivelPicante: 'natural' },
    ] },
  }, include: { items: true } });
  await prisma.historialOrden.create({ data: { ordenId: order.id, tipoAccion: 'consumo_creado', descripcion: 'Fixture histórica',
    usuarioNombre: actor.nombre, usuarioRol: actor.rol, datosDespues: { empleadoId: f.employee.id, empleadoNombre: f.employee.nombre,
      receiptLines: null, items: order.items.map(i => ({ itemId: i.id, envase: i.productoId === f.combo.id })) } } });
  // Inventory represents the already reserved stock, not a reservation to repeat.
  await prisma.producto.update({ where: { id: f.cola.id }, data: { stock: 8 } });
  await prisma.producto.update({ where: { id: f.combo.id }, data: { stock: 9 } });
  return { ...f, order };
}

async function historicalTests() {
  const regularization = load<typeof import('./employee-consumption-regularization')>('lib/employee-consumption-regularization.ts', dependencies);
  const cutoff = new Date().toISOString();
  const batch = async (id: string) => {
    const analyzed = await regularization.analyzeRegularization(prisma, { corte: cutoff });
    const candidate = analyzed.candidatos.find(c => c.ordenId === id);
    assert.ok(candidate, 'Fixture debe estar en el análisis histórico');
    return { clientRequestId: randomUUID(), motivo: 'Ensayo de corte aislado', corte: cutoff,
      candidatos: [{ ordenId: id, expectedRevision: candidate.expectedRevision, fingerprint: candidate.fingerprint }] };
  };
  for (const state of ['pendiente', 'en_preparacion', 'lista']) {
    const f = await legacyFixture(state);
    await prisma.usuario.update({ where: { id: f.employee.id }, data: { activo: false, cuentaActivadaAt: null } });
    const input = await batch(f.order.id);
    const race = await Promise.all([regularization.executeRegularization(prisma, input, actor), regularization.executeRegularization(prisma, input, actor)]);
    assert.equal(race.flatMap(r => r.resultados).filter(r => r.estado === 'regularizado').length, 1);
    assert.equal(await prisma.movimientoCuentaEmpleado.count({ where: { ordenId: f.order.id } }), 1);
    assert.equal((await prisma.orden.findUniqueOrThrow({ where: { id: f.order.id } })).estado, 'entregada');
    assert.equal((await prisma.producto.findUniqueOrThrow({ where: { id: f.cola.id } })).stock, 8);
    const user = await prisma.usuario.findUniqueOrThrow({ where: { id: f.employee.id } });
    assert.equal(user.activo, false); assert.equal(user.cuentaActivadaAt, null);
    await assert.rejects(() => consumption.createConsumption(f.body, actor), accounts.AccountError);
    const activate = load<typeof import('../app/api/empleados/[id]/activar/route')>('app/api/empleados/[id]/activar/route.ts', {
      ...dependencies, '@/lib/session': { getAuthenticatedUser: async () => actor },
      '@/lib/employee-account-validation': accountValidation, '@/types/retiro': requireFromHere('../types/retiro'),
    });
    const response = await activate.POST(new Request('http://localhost/test', { method: 'POST', body: JSON.stringify({
      clientRequestId: randomUUID(), razon: 'Apertura posterior a deuda histórica', expectedRetiros: [], adelantos: [],
    }) }), { params: Promise.resolve({ id: f.employee.id }) });
    assert.equal(response.status, 200);
    assert.equal((await prisma.$transaction(tx => accounts.accountBalance(tx, f.employee.id))).decimal.toString(), '6.75');
    assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: f.employee.id } })).cuentaRevision, 1);
  }

  // Exercise the actual settlement route against regularization, not a simulated lock.
  const f = await legacyFixture();
  await prisma.$transaction(tx => accounts.appendEmployeeMovement(tx, { empleadoId: f.employee.id, tipo: 'ADELANTO', monto: 30,
    motivo: 'Fixture adelanto', autor: actor, origenClave: randomUUID(), idempotencyKey: randomUUID() }));
  const settlements = load<typeof import('../app/api/empleados/[id]/liquidaciones/route')>('app/api/empleados/[id]/liquidaciones/route.ts', {
    ...dependencies, '@/lib/session': { getAuthenticatedUser: async () => actor }, '@/lib/employee-account-validation': accountValidation,
    '@/lib/employee-print': { ...printing, enqueueEmployeeReceipt: async () => null,
      sendEmployeeReceiptAfterCommit: async () => ({ impresionEnviada: false, impresionError: null }) },
  });
  const settle = async (revision: number, amount: number) => settlements.POST(new Request('http://localhost/test', { method: 'POST', body: JSON.stringify({
    clientRequestId: randomUUID(), expectedRevision: revision, fechaDescuento: '2026-11-04', monto: amount,
  }) }), { params: Promise.resolve({ id: f.employee.id }) });
  const first = await settle(1, 10); assert.equal(first.status, 201);
  const frozen = await prisma.liquidacionEmpleado.findMany({ where: { empleadoId: f.employee.id } });
  const input = await batch(f.order.id);
  const [regularized, closed] = await Promise.all([regularization.executeRegularization(prisma, input, actor), settle(2, 5)]);
  assert.equal(regularized.resultados[0].estado, 'regularizado');
  assert.ok([201, 409].includes(closed.status));
  assert.deepEqual(await prisma.liquidacionEmpleado.findMany({ where: { id: frozen[0].id } }), frozen);
  assert.equal((await prisma.producto.findUniqueOrThrow({ where: { id: f.combo.id } })).stock, 9);
  const replay = await regularization.executeRegularization(prisma, input, actor);
  assert.equal(replay.totalCargosAgregados, 0);
  assert.equal(await prisma.movimientoCuentaEmpleado.count({ where: { ordenId: f.order.id, tipo: 'CONSUMO' } }), 1);
  const transferred = await legacyFixture();
  await prisma.$transaction(tx => accounts.appendEmployeeMovement(tx, { empleadoId: transferred.employee.id, tipo: 'CONSUMO', monto: '6.75',
    motivo: 'Cargo histórico existente', autor: actor, ordenId: transferred.order.id,
    origenClave: `consumo:${transferred.order.id}`, idempotencyKey: `consumo:${transferred.order.id}` }));
  await prisma.orden.update({ where: { id: transferred.order.id }, data: { estado: 'entregada' } });
  await consumption.changeConsumption(transferred.order.id, 'corregir', { clientRequestId: randomUUID(), razon: 'Traslado histórico válido', nuevoEmpleadoId: f.employee.id }, actor);
  await prisma.orden.update({ where: { id: transferred.order.id }, data: { estado: 'lista' } });
  const movementsBefore = await prisma.movimientoCuentaEmpleado.findMany({ where: { ordenId: transferred.order.id }, orderBy: { id: 'asc' } });
  const preserved = await regularization.executeRegularization(prisma, await batch(transferred.order.id), actor);
  assert.equal(preserved.resultados[0].estado, 'regularizado');
  assert.equal(preserved.totalCargosAgregados, 0);
  assert.deepEqual(await prisma.movimientoCuentaEmpleado.findMany({ where: { ordenId: transferred.order.id }, orderBy: { id: 'asc' } }), movementsBefore);
  const beforeCorrection = await batch((await legacyFixture()).order.id);
  const corrected = beforeCorrection.candidatos[0];
  const simultaneous = await Promise.allSettled([
    regularization.executeRegularization(prisma, beforeCorrection, actor),
    consumption.changeConsumption(corrected.ordenId, 'corregir', { clientRequestId: randomUUID(), razon: 'Cambio concurrente', nuevoEmpleadoId: f.employee.id }, actor),
  ]);
  assert.equal(simultaneous[0].status, 'fulfilled');
  if (simultaneous[1].status === 'rejected') {
    assert.ok(simultaneous[1].reason instanceof accounts.AccountError);
    assert.equal(simultaneous[1].reason.status, 409);
    assert.match(simultaneous[1].reason.message, /Antes de la entrega/);
  } else {
    assert.equal(simultaneous[1].value.orden?.empleadoId, f.employee.id);
    assert.equal(await prisma.movimientoCuentaEmpleado.count({ where: { ordenId: corrected.ordenId, tipo: 'REVERSO_CONSUMO' } }), 1);
    assert.equal(await prisma.historialOrden.count({ where: { ordenId: corrected.ordenId, tipoAccion: 'consumo_corregido' } }), 1);
  }
  assert.equal(await prisma.movimientoCuentaEmpleado.count({ where: { ordenId: corrected.ordenId, origenClave: `consumo:${corrected.ordenId}` } }), 1);

  const fail = await legacyFixture(); const valid = await legacyFixture();
  const a = await batch(fail.order.id); const b = await batch(valid.order.id);
  const failureDb = prisma.$extends({ query: { historialOrden: { async create({ args, query }) {
    if (args.data.ordenId === fail.order.id && args.data.tipoAccion === 'consumo_regularizado_entregado') throw new Error('fixture history failure');
    return query(args);
  } } } });
  const partial = await regularization.executeRegularization(failureDb as unknown as PrismaClient, { ...a, candidatos: [...a.candidatos, ...b.candidatos] }, actor);
  assert.deepEqual(partial.resultados.map(r => r.estado), ['conflicto', 'regularizado']);
  assert.equal(await prisma.movimientoCuentaEmpleado.count({ where: { ordenId: fail.order.id } }), 0);
  assert.equal((await prisma.orden.findUniqueOrThrow({ where: { id: fail.order.id } })).estado, 'pendiente');
  assert.equal((await prisma.producto.findUniqueOrThrow({ where: { id: fail.combo.id } })).stock, 9);
  const queueNow = new Date();
  const processing = await prisma.printJob.create({ data: { ordenId: f.order.id, type: 'ORDER', status: 'PROCESSING',
    dedupeKey: randomUUID(), revision: 0, payload: {}, attempts: 1, workerId: 'old-worker',
    availableAt: queueNow, autoPrintUntil: new Date(queueNow.getTime() + 60000), leaseExpiresAt: new Date(queueNow.getTime() - 1000) } });
  assert.equal(await claimNextPrintJob(prisma, 'new-worker', queueNow), null, 'Una comanda interna vencida no se reenvía tras volver a RETRY');
  assert.notEqual((await prisma.printJob.findUniqueOrThrow({ where: { id: processing.id } })).status, 'PROCESSING');
  const manual = await prisma.printJob.create({ data: { ordenId: f.order.id, type: 'EMPLOYEE_RECEIPT',
    dedupeKey: randomUUID(), revision: 1, payload: {}, availableAt: queueNow, autoPrintUntil: new Date(queueNow.getTime() + 60000) } });
  assert.equal((await claimNextPrintJob(prisma, 'receipt-worker', queueNow, 30, ['EMPLOYEE_RECEIPT']))?.id, manual.id);
  const customer = await prisma.orden.create({ data: { mesero: actor.nombre, total: '1' } });
  const kitchen = await prisma.printJob.create({ data: { ordenId: customer.id, type: 'ORDER',
    dedupeKey: randomUUID(), revision: 0, payload: {}, availableAt: queueNow, autoPrintUntil: new Date(queueNow.getTime() + 60000) } });
  assert.equal((await claimNextPrintJob(prisma, 'customer-worker', queueNow))?.id, kitchen.id);
  console.log('PostgreSQL: transición, replay, cuenta histórica/apertura aditiva, cierre, corrección y rollback por documento aprobados.');
}

async function fixture() {
  const employee = await prisma.usuario.create({ data: { nombre: 'Prueba', rol: 'mesero', cuentaActivadaAt: new Date() } });
  const cola = await prisma.producto.create({ data: { nombre: 'Cola', categoria: 'Bebidas', precio: '1', precioEmpleado: '.75', stock: 10 } });
  const combo = await prisma.producto.create({ data: { nombre: 'Combo', categoria: 'Combo', precio: '5', precioEmpleado: '4', stock: 10 } });
  const body = { clientRequestId: randomUUID(), empleadoId: employee.id, tipoOrden: 'para_llevar' as const, items: [
    { productoId: cola.id, cantidad: 2, precioEsperado: .75 },
    { productoId: combo.id, cantidad: 1, precioEsperado: 4, nivelPicante: 'natural' },
  ] };
  return { employee, cola, combo, body };
}

async function run() {
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: isolatedUrl }, encoding: 'utf8', timeout: 120000,
  });
  if (migration.status !== 0) throw new Error('No se pudo preparar el esquema aislado de pruebas con las migraciones existentes.');
  await prisma.usuario.create({ data: { id: actor.id, nombre: actor.nombre, rol: actor.rol } });
  const f = await fixture();
  await prisma.$transaction(tx => accounts.appendEmployeeMovement(tx, { empleadoId: f.employee.id, tipo: 'ADELANTO', monto: 30,
    motivo: 'Fixture adelanto', autor: actor, origenClave: randomUUID(), idempotencyKey: randomUUID() }));
  const results = await Promise.all([consumption.createConsumption(f.body, actor), consumption.createConsumption(f.body, actor)]);
  assert.equal(results.filter(r => !r.replay).length, 1);
  assert.equal(results[0].orden.estado, 'entregada');
  assert.equal(results[0].orden.total.toString(), '6.75');
  assert.equal(await prisma.orden.count({ where: { empleadoId: f.employee.id } }), 1);
  assert.equal(await prisma.movimientoCuentaEmpleado.count({ where: { ordenId: results[0].orden.id } }), 1);
  assert.equal((await prisma.producto.findUniqueOrThrow({ where: { id: f.cola.id } })).stock, 8);
  assert.equal((await prisma.$transaction(tx => accounts.accountBalance(tx, f.employee.id))).decimal.toString(), '36.75');
  assert.equal(await prisma.printJob.count(), 0);
  const replay = await consumption.createConsumption(f.body, actor); // Response lost after commit.
  assert.equal(replay.replay, true);
  await assert.rejects(() => consumption.createConsumption({ ...f.body, tipoOrden: 'local' }, actor), /clave/);

  const last = await fixture();
  const competitor = await prisma.usuario.create({ data: { nombre: 'Otro empleado', rol: 'mesero', cuentaActivadaAt: new Date() } });
  await prisma.producto.update({ where: { id: last.cola.id }, data: { stock: 1 } });
  const body = { ...last.body, tipoOrden: 'local' as const, items: [{ productoId: last.cola.id, cantidad: 1, precioEsperado: .75 }] };
  const race = await Promise.allSettled([consumption.createConsumption(body, actor), consumption.createConsumption({ ...body, empleadoId: competitor.id, clientRequestId: randomUUID() }, actor)]);
  assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await prisma.producto.findUniqueOrThrow({ where: { id: last.cola.id } })).stock, 0);
  assert.equal(await prisma.orden.count({ where: { empleadoId: { in: [last.employee.id, competitor.id] } } }), 1);

  const rejected = await fixture();
  for (const state of [{ activo: false, cuentaActivadaAt: new Date() }, { activo: true, cuentaActivadaAt: null }]) {
    await prisma.usuario.update({ where: { id: rejected.employee.id }, data: state });
    await assert.rejects(() => consumption.createConsumption(rejected.body, actor), accounts.AccountError);
    assert.equal(await prisma.orden.count({ where: { empleadoId: rejected.employee.id } }), 0);
    assert.equal(await prisma.movimientoCuentaEmpleado.count({ where: { empleadoId: rejected.employee.id } }), 0);
    assert.equal((await prisma.producto.findUniqueOrThrow({ where: { id: rejected.cola.id } })).stock, 10);
  }
  await prisma.usuario.update({ where: { id: rejected.employee.id }, data: { cuentaActivadaAt: new Date() } });
  await assert.rejects(() => consumption.createConsumption({ ...rejected.body, items: [{ ...rejected.body.items[0], precioEsperado: .5 }] }, actor), /precio/);

  // A failure after document/stock creation must roll back the real transaction.
  const broken = load<typeof import('./employee-consumption')>('lib/employee-consumption.ts', {
    ...dependencies, '@/lib/employee-account': { ...accounts, appendEmployeeMovement: async () => { throw new Error('fixture write failure'); } },
  });
  const beforeCounter = await prisma.contadorOrdenDiaria.findMany();
  await assert.rejects(() => broken.createConsumption(rejected.body, actor), /fixture write failure/);
  assert.equal(await prisma.orden.count({ where: { empleadoId: rejected.employee.id } }), 0);
  assert.equal((await prisma.producto.findUniqueOrThrow({ where: { id: rejected.cola.id } })).stock, 10);
  assert.deepEqual(await prisma.contadorOrdenDiaria.findMany(), beforeCounter);
  assert.equal(await prisma.historialOrden.count({ where: { orden: { empleadoId: rejected.employee.id } } }), 0);
  await historicalTests();
  console.log('PostgreSQL: alta, replay concurrente, última unidad, centavos, elegibilidad y rollback aprobados.');
}

run().catch(error => { console.error(error instanceof Error ? error.message : 'Fallo de integración PostgreSQL'); process.exitCode = 1; })
  .finally(async () => {
    // Only this randomly named schema, in the explicit test database, belongs to this run.
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {
      console.error(`No se pudo retirar el esquema aislado ${schema}; revisar la base de pruebas.`);
      process.exitCode = 1;
    });
    await prisma.$disconnect();
  });
