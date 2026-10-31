import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { Prisma } from '@prisma/client';
import { buildWithdrawalPrintPayload, enqueueWithdrawalPrintJob, getWithdrawalPrintMode } from './withdrawal-print';
import * as withdrawalPrint from './withdrawal-print';
import * as retiroDomain from './retiros';
import * as retiroValidation from './retiros-validaciones';
import * as retiroTypes from '../types/retiro';
import * as cajaTypes from '../types/caja';
import type { PrintJobTransaction } from './print-jobs';
import * as printJobs from './print-jobs';

async function run() {
  const source = {
    id: 'cm-retiro-123', monto: new Prisma.Decimal('20.50'), categoria: 'adelanto',
    motivo: 'Adelanto semanal', usuarioNombre: 'María', beneficiarioNombre: 'Andrés',
    estado: 'registrado', createdAt: new Date('2026-10-31T18:42:18.000Z'),
  };
  const advance = buildWithdrawalPrintPayload(source);
  assert.equal(advance.withdrawalId, source.id);
  assert.ok(advance.lines.includes('Entrega: Maria'));
  assert.ok(advance.lines.includes('Recibe: Andres'));
  assert.ok(advance.lines.includes('Firma de quien recibe:'));
  assert.ok(advance.lines.includes('Firma de quien entrega:'));
  assert.equal(advance.lines.filter((line) => line.startsWith('Firma')).length, 2);
  assert.ok(advance.lines.some((line) => line.includes('13:42:18')));
  const amountLine = advance.lines.find((line) => line.startsWith('MONTO RETIRADO:'))!;
  assert.equal(amountLine.length, 42);
  assert.ok(amountLine.endsWith('$20.50'));
  const expense = buildWithdrawalPrintPayload({ ...source, categoria: 'insumos', beneficiarioNombre: null });
  assert.ok(expense.lines.includes('RETIRO DE CAJA'));
  assert.ok(expense.lines.includes('Retirado por: Maria'));
  assert.equal(expense.lines.some((line) => line.startsWith('Firma')), false);
  assert.ok(buildWithdrawalPrintPayload(source, true).lines.includes('COPIA DE COMPROBANTE'));
  assert.throws(() => buildWithdrawalPrintPayload({ ...source, estado: 'anulado' }), /no valido/);
  assert.throws(() => buildWithdrawalPrintPayload({ ...source, beneficiarioNombre: null }), /quien recibe/);
  const long = buildWithdrawalPrintPayload({ ...source, motivo: 'Compra de camarón\n' + 'X'.repeat(100) });
  assert.ok(long.lines.every((line) => line.length <= 42 && /^[\x20-\x7E]*$/.test(line)));
  assert.ok(long.lines.join('').includes('X'.repeat(100)));

  const initial = { ...source, usuarioId: 'mesero-1', usuarioRol: 'mesero', beneficiarioId: 'empleado-2',
    clientRequestId: 'request-1', anuladoPorNombre: null, razonAnulacion: null, anuladoAt: null,
    printJobs: [] as Array<{ status: string }> };
  let stored: typeof initial | null = null;
  const jobs: Array<Prisma.PrintJobUncheckedCreateInput & { id: string }> = [];
  let insideTransaction = false;
  let failQueue = false;
  let user: { id: string; nombre: string; rol: string } | null = { id: 'mesero-1', nombre: 'Maria', rol: 'mesero' };
  const tx = {
    $queryRaw: async () => [],
    retiroCaja: {
      create: async ({ data }: { data: Partial<typeof initial> }) => {
        assert.ok(insideTransaction);
        stored = { ...initial, ...data };
        return stored;
      },
      findUnique: async () => stored,
      findUniqueOrThrow: async () => stored!,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        stored = { ...stored, ...data } as typeof initial;
        return { count: 1 };
      },
    },
    printJob: {
      upsert: async (args: Prisma.PrintJobUpsertArgs) => {
        assert.ok(insideTransaction, 'El comprobante se guarda dentro de la transaccion del retiro');
        if (failQueue) throw new Error('cola no disponible');
        const existing = jobs.find((job) => job.dedupeKey === args.where.dedupeKey);
        if (existing) return existing;
        const job = { ...args.create, id: `job-${jobs.length}` } as Prisma.PrintJobUncheckedCreateInput & { id: string };
        jobs.push(job);
        return job;
      },
      findFirst: async () => jobs.at(-1) ?? null,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(jobs.at(-1)!, data),
      updateMany: async ({ where, data }: { where: { status: { in: string[] } }; data: Record<string, unknown> }) => {
        for (const job of jobs) if (where.status.in.includes(job.status ?? 'PENDING')) Object.assign(job, data);
        return { count: jobs.length };
      },
    },
  };
  const fakePrisma = {
    retiroCaja: tx.retiroCaja,
    usuario: { findFirst: async () => ({ id: 'empleado-2', nombre: 'Andres' }) },
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => {
      const before = stored;
      const jobCount = jobs.length;
      insideTransaction = true;
      try { return await callback(tx); }
      catch (error) { stored = before; jobs.splice(jobCount); throw error; }
      finally { insideTransaction = false; }
    },
  };
  type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  // Ejecuta los handlers reales con sus fronteras de BD, sesion e impresora simuladas.
  function loadPost(file: string, method = 'POST'): Handler {
    const dependencies: Record<string, unknown> = {
      'next/server': { NextResponse: { json: Response.json } },
      '@prisma/client': { Prisma }, '@/lib/db': { prisma: fakePrisma },
      '@/lib/caja': { bloquearCajaAbierta: async () => {}, CajaNoDisponibleError: class extends Error {}, obtenerCajaDeHoy: async () => ({ estado: 'abierta' }) },
      '@/lib/fecha-ecuador': {}, '@/lib/retiros': retiroDomain, '@/lib/retiros-validaciones': retiroValidation,
      '@/lib/session': { getAuthenticatedUser: async () => user }, '@/types/retiro': retiroTypes,
      '@/types/caja': cajaTypes, '@/lib/withdrawal-print': withdrawalPrint,
      '@/lib/print-jobs': printJobs,
      '@/lib/printer': { PrinterService: class { constructor() { throw new Error('No se debe imprimir directo en modo cola'); } } },
    };
    const js = transpileModule(readFileSync(resolve(file), 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2017 } }).outputText;
    const routeModule = { exports: {} as Record<string, Handler> };
    new Function('require', 'module', 'exports', 'console', js)(
      (name: string) => { assert.ok(name in dependencies, `Dependencia sin simular: ${name}`); return dependencies[name]; },
      routeModule, routeModule.exports, { error: () => {} },
    );
    return routeModule.exports[method];
  }
  const env = { queue: process.env.PRINT_QUEUE_ENABLED, direct: process.env.DIRECT_PRINT_ENABLED, cutover: process.env.PRINT_CUTOVER_AT };
  try {
    process.env.PRINT_QUEUE_ENABLED = 'true';
    process.env.DIRECT_PRINT_ENABLED = 'true';
    delete process.env.PRINT_CUTOVER_AT;
    assert.equal(getWithdrawalPrintMode(new Date()), 'queue', 'Nunca imprime por dos mecanismos');
    const post = loadPost('app/api/retiros/route.ts');
    const context = { params: Promise.resolve({ id: source.id }) };
    const request = () => new Request('http://localhost/api/retiros', { method: 'POST', body: JSON.stringify({
      categoria: 'adelanto', motivo: 'Adelanto semanal', monto: 20.5, beneficiarioId: 'empleado-2', clientRequestId: 'request-1',
    }) });
    assert.equal((await post(request(), context)).status, 201);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].retiroId, source.id);
    assert.equal(jobs[0].ordenId, undefined);
    assert.equal((await post(request(), context)).status, 200);
    assert.equal(jobs.length, 1, 'Reintentar el registro no imprime ni retira dos veces');
    const print = loadPost('app/api/retiros/[id]/imprimir/route.ts');
    assert.equal((await print(new Request('http://localhost'), context)).status, 200);
    assert.equal(jobs.length, 1, 'Si ya esta pendiente no crea otra copia');
    jobs[0].status = 'SUCCEEDED';
    assert.equal((await print(new Request('http://localhost'), context)).status, 200);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[1].revision, 1);
    assert.ok(JSON.stringify(jobs[1].payload).includes('COPIA DE COMPROBANTE'));
    jobs[1].status = 'FAILED';
    assert.equal((await print(new Request('http://localhost'), context)).status, 200);
    assert.equal(jobs.length, 2, 'Reintenta un fallo sin crear otro trabajo');
    assert.equal(jobs[1].status, 'PENDING');
    user = { id: 'otro', nombre: 'Otro', rol: 'mesero' };
    assert.equal((await post(request(), context)).status, 409);
    assert.equal((await print(new Request('http://localhost'), context)).status, 403);
    user = null;
    assert.equal((await print(new Request('http://localhost'), context)).status, 401);
    user = { id: 'mesero-1', nombre: 'Maria', rol: 'mesero' };
    user = { id: 'admin-1', nombre: 'Admin', rol: 'admin' };
    const cancel = loadPost('app/api/retiros/[id]/anular/route.ts', 'PATCH');
    assert.equal((await cancel(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ razon: 'Registro incorrecto' }) }), context)).status, 200);
    assert.equal(jobs[1].status, 'DISCARDED');
    stored = { ...initial, estado: 'anulado' };
    assert.equal((await print(new Request('http://localhost'), context)).status, 409);
    stored = null;
    jobs.splice(0);
    user = { id: 'mesero-1', nombre: 'Maria', rol: 'mesero' };
    failQueue = true;
    assert.equal((await post(request(), context)).status, 500);
    assert.equal(stored, null, 'Un fallo al encolar revierte el registro del retiro');
    assert.equal(jobs.length, 0);

    failQueue = false;
    insideTransaction = true;
    await enqueueWithdrawalPrintJob(tx as unknown as PrintJobTransaction, source);
    await enqueueWithdrawalPrintJob(tx as unknown as PrintJobTransaction, source);
    assert.equal(jobs.length, 1);
    insideTransaction = false;
    process.env.PRINT_QUEUE_ENABLED = 'false';
    assert.equal(getWithdrawalPrintMode(new Date()), 'direct');
    stored = null;
    const directResponse = await post(request(), context);
    assert.equal(directResponse.status, 201, 'Un fallo directo no devuelve error de registro financiero');
    assert.ok((await directResponse.json()).impresionError);
    assert.ok(stored, 'El retiro confirmado sobrevive al fallo de impresora');
    process.env.DIRECT_PRINT_ENABLED = 'false';
    assert.equal(getWithdrawalPrintMode(new Date()), 'disabled');
  } finally {
    for (const [key, value] of Object.entries({ PRINT_QUEUE_ENABLED: env.queue, DIRECT_PRINT_ENABLED: env.direct, PRINT_CUTOVER_AT: env.cutover })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  console.log('withdrawal receipt and route tests: ok');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
