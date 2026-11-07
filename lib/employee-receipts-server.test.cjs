/* eslint-disable @typescript-eslint/no-require-imports -- inject database and printer before loading the server module */
// Run with: TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}' node -r ts-node/register/transpile-only lib/employee-receipts-server.test.cjs
require('tsconfig-paths').register({ baseUrl: process.cwd(), paths: { '@/*': ['*'] } });
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { AccountError } = require('./employee-account');
const D = value => new Prisma.Decimal(value);
const admin = { id: 'admin', nombre: 'Admin', rol: 'admin' };
const owner = { id: 'owner', nombre: 'Ana', rol: 'cocina' };
const stranger = { id: 'stranger', nombre: 'Otro', rol: 'digital' };
const originalLines = ['Empleado original: Ana', '1x Comida $4.00'];
const order = { id: 'o1', tipoOperacion: 'CONSUMO_EMPLEADO', creadorId: 'mesero', empleadoId: 'new-owner', estado: 'entregada', historial: [{ datosDespues: { receiptLines: originalLines } }] };
const settlement = { id: 's1', empleadoId: 'owner', empleadoNombre: 'Ana', autorNombre: 'Admin', fechaDescuento: new Date('2026-11-01T12:00:00Z'), saldoAnterior: D(4), montoAplicado: D(4), saldoPosterior: D(0), snapshot: { saldoArrastrado: 0, movimientos: [{ tipo: 'CONSUMO', motivo: 'Comida', monto: '4.00' }] } };
const jobs = [];
let inside = false;
let reversed = false;
let directCalls = 0;
let directPayload;
let directResult = { success: true };
const monetaryAndStockSnapshot = JSON.stringify({ order, settlement });
const tx = {
  $queryRaw: async (_strings, id) => [{ id }],
  usuario: { findUniqueOrThrow: async ({ where }) => ({ id: where.id, activo: true, cuentaActivadaAt: new Date(), cuentaRevision: 0 }) },
  orden: { findUnique: async ({ where }) => where.id === order.id ? order : null },
  liquidacionEmpleado: { findFirst: async ({ where }) => where.id === settlement.id && where.empleadoId === settlement.empleadoId ? settlement : null },
  movimientoCuentaEmpleado: { findFirst: async ({ where }) => where.tipo === 'REVERSO_LIQUIDACION' ? (reversed ? { id: 'reverse' } : null) : (where.ordenId === order.id && where.empleadoId === owner.id ? { id: 'origin' } : null) },
  printJob: {
    findFirst: async ({ where }) => jobs.filter(j => j.dedupeKey.startsWith(where.dedupeKey.startsWith)).sort((a, b) => b.revision - a.revision)[0] ?? null,
    upsert: async ({ create }) => { assert.equal(inside, true); const job = { ...create, status: 'PENDING' }; jobs.push(job); return job; },
  },
};
const prisma = { $transaction: async fn => { assert.equal(inside, false); inside = true; try { return await fn(tx); } finally { inside = false; } } };
function stub(path, exports) { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub('./db', { prisma });
stub('./printer', { PrinterService: class { async imprimirEmpleado(payload) { assert.equal(inside, false, 'La impresión directa ocurre después del commit'); directCalls++; directPayload = payload; return directResult; } } });
const { printEmployeeReceipt } = require('./employee-receipts-server');
const rejects = async (fn, status) => assert.rejects(fn, err => err instanceof AccountError && err.status === status);
(async () => {
  const environment = { ...process.env };
  try {
    process.env.PRINT_QUEUE_ENABLED = 'true'; process.env.DIRECT_PRINT_ENABLED = 'false'; delete process.env.PRINT_CUTOVER_AT;
    await rejects(() => printEmployeeReceipt(stranger, { empleadoId: 'owner', liquidacionId: 's1' }), 403);
    await rejects(() => printEmployeeReceipt(admin, { empleadoId: 'new-owner', liquidacionId: 's1' }), 404);
    await rejects(() => printEmployeeReceipt(stranger, { ordenId: 'o1' }), 403);
    await rejects(() => printEmployeeReceipt(admin, { ordenId: 'other-order' }), 404);
    assert.equal(jobs.length, 0, 'Un documento guardado no se imprime hasta solicitarlo');
    const consumption = await printEmployeeReceipt(owner, { ordenId: 'o1' });
    assert.equal(consumption.impresionEnCola, true);
    assert.equal(jobs[0].type, 'EMPLOYEE_RECEIPT', 'La solicitud solo produce comprobante, nunca comanda');
    assert.deepEqual(jobs[0].payload.lines.slice(2), originalLines, 'La copia conserva el documento congelado después de reasignar');
    assert.equal(jobs[0].revision, 1);
    const firstCount = jobs.length;
    await printEmployeeReceipt(admin, { ordenId: 'o1' });
    assert.equal(jobs.length, firstCount, 'PENDING se reutiliza');
    await printEmployeeReceipt({ id: 'mesero', nombre: 'Creador', rol: 'mesero' }, { ordenId: 'o1' });
    await printEmployeeReceipt({ id: 'new-owner', nombre: 'Beneficiario actual', rol: 'cocina' }, { ordenId: 'o1' });
    assert.equal(jobs.length, firstCount, 'Creador y beneficiario actual autorizados reutilizan el comprobante');
    jobs[0].status = 'RETRY'; await printEmployeeReceipt(owner, { ordenId: 'o1' });
    assert.equal(jobs.length, firstCount, 'RETRY se reutiliza');
    jobs[0].status = 'PROCESSING'; await printEmployeeReceipt(owner, { ordenId: 'o1' });
    assert.equal(jobs.length, firstCount, 'PROCESSING se reutiliza sin duplicar el envío');
    jobs[0].status = 'FAILED'; await printEmployeeReceipt(owner, { ordenId: 'o1' });
    assert.equal(jobs[1].revision, 2, 'Un trabajo fallido crea copia nueva');
    jobs[1].status = 'SUCCEEDED'; await printEmployeeReceipt(admin, { ordenId: 'o1' });
    assert.equal(jobs[2].revision, 3, 'Una copia posterior usa otra revisión');
    reversed = true;
    const settled = await printEmployeeReceipt(owner, { empleadoId: 'owner', liquidacionId: 's1' });
    assert.equal(settled.impresionEnCola, true);
    assert.ok(jobs[3].payload.lines.includes('DESCUENTO REVERTIDO - VER HISTORIAL'));
    assert.ok(jobs[3].payload.lines.some(line => line.includes('CONSUMO: Comida')));
    process.env.PRINT_QUEUE_ENABLED = 'false'; process.env.DIRECT_PRINT_ENABLED = 'true';
    const direct = await printEmployeeReceipt(admin, { empleadoId: 'owner', liquidacionId: 's1' });
    assert.equal(direct.impresionEnviada, true); assert.equal(directCalls, 1);
    assert.ok(directPayload.lines.includes('DESCUENTO REVERTIDO - VER HISTORIAL'));
    assert.equal(jobs.length, 4, 'No se encola en modo directo');
    directResult = { success: false, error: 'Impresora desconectada' };
    const failed = await printEmployeeReceipt(admin, { ordenId: 'o1' });
    assert.equal(failed.impresionEnviada, false);
    assert.ok(failed.impresionError, 'Un fallo de impresión se informa sobre el documento existente');
    directResult = { success: true };
    const recovered = await printEmployeeReceipt(admin, { ordenId: 'o1' });
    assert.equal(recovered.impresionEnviada, true, 'Se puede volver a solicitar el mismo comprobante');
    assert.equal(JSON.stringify({ order, settlement }), monetaryAndStockSnapshot, 'Primera impresión, copias y recuperación conservan documentos y cierres');
    order.historial.push({ tipoAccion: 'consumo_regularizado_entregado', datosDespues: { receiptLines: ['Documento de regularización'] } });
    const regularized = await printEmployeeReceipt(admin, { ordenId: 'o1' });
    assert.equal(regularized.impresionEnviada, true);
    assert.deepEqual(directPayload.lines.slice(2), originalLines, 'La regularización no reemplaza un snapshot original existente');
    order.estado = 'pendiente';
    const callsBefore = directCalls;
    await rejects(() => printEmployeeReceipt(admin, { ordenId: 'o1' }), 409);
    assert.equal(directCalls, callsBefore, 'Un antecedente sin regularizar no se imprime como entrega');
    order.estado = 'entregada';
  } finally {
    for (const key of ['PRINT_QUEUE_ENABLED', 'DIRECT_PRINT_ENABLED', 'PRINT_CUTOVER_AT']) {
      if (environment[key] === undefined) delete process.env[key]; else process.env[key] = environment[key];
    }
  }
  console.log('employee receipt server tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
