import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as cobro from '../types/cobro';
import * as ordenTypes from '../types/orden';
import * as fecha from './fecha-ecuador';

function loadModule<T>(file: string, dependencies: Record<string, unknown>): T {
  const js = transpileModule(readFileSync(resolve(file), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2017 },
  }).outputText;
  const routeModule = { exports: {} };
  new Function('require', 'module', 'exports', js)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Dependencia no simulada: ${name}`);
    return dependencies[name];
  }, routeModule, routeModule.exports);
  return routeModule.exports as T;
}

class CajaNoDisponibleError extends Error {}

async function run() {
  let actor: { id: string; nombre: string; rol: string } | null = { id: 'a1', nombre: 'Admin', rol: 'admin' };
  let cajaAbierta = true;
  type Pago = { id: string; ordenId: string; metodoPago: string; monto: string; estado: string; createdAt: Date; comprobanteTransferenciaKey: string | null; efectivoRecibido?: number; transferenciaRecibida?: number };
  let pagos: Pago[] = [];
  let orden = { anulada: false, metodoPago: 'efectivo' as string | null };
  const historial: Array<Record<string, unknown>> = [];

  const tx = {
    cobro: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const p = pagos.find((x) => x.id === where.id);
        return p ? { ...p, orden } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Pago> }) => {
        pagos = pagos.map((p) => (p.id === where.id ? { ...p, ...data } : p));
      },
      findMany: async () => pagos.map((p) => ({ metodoPago: p.metodoPago })),
    },
    orden: { update: async ({ data }: { data: { metodoPago: string | null } }) => { orden = { ...orden, ...data }; } },
    historialOrden: { create: async ({ data }: { data: Record<string, unknown> }) => { historial.push(data); } },
  };
  const route = loadModule<{ PATCH: (r: Request, c: { params: Promise<{ id: string; pagoId: string }> }) => Promise<Response> }>(
    'app/api/admin/ordenes/[id]/pagos/[pagoId]/route.ts',
    {
      'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      '@/lib/caja': {
        CajaNoDisponibleError,
        bloquearCajaAbierta: async () => { if (!cajaAbierta) throw new CajaNoDisponibleError('La caja de hoy ya fue cerrada'); },
      },
      '@/lib/db': { prisma: { $transaction: async <T>(cb: (c: typeof tx) => Promise<T>) => cb(tx) } },
      '@/lib/fecha-ecuador': fecha,
      '@/lib/session': { getAuthenticatedUser: async () => actor },
      '@/types/cobro': cobro,
      '@/types/orden': ordenTypes,
    },
  );
  const patch = (metodoPago: unknown, pagoId = 'p1') =>
    route.PATCH(
      new Request('http://x', { method: 'PATCH', body: JSON.stringify({ metodoPago }) }),
      { params: Promise.resolve({ id: 'o1', pagoId }) },
    );
  const reset = (extra: Partial<Pago> = {}) => {
    pagos = [{ id: 'p1', ordenId: 'o1', metodoPago: 'efectivo', monto: '12.50', estado: 'CONFIRMADO', createdAt: new Date(), comprobanteTransferenciaKey: null, ...extra }];
    orden = { anulada: false, metodoPago: pagos[0].metodoPago };
    historial.length = 0;
  };

  // efectivo -> transferencia mueve el monto de columna y resume la orden
  reset();
  let res = await patch('transferencia');
  assert.equal(res.status, 200);
  assert.equal(pagos[0].metodoPago, 'transferencia');
  assert.equal(pagos[0].transferenciaRecibida, 12.5);
  assert.equal(pagos[0].efectivoRecibido, 0);
  assert.equal(orden.metodoPago, 'transferencia');
  assert.equal(historial[0].tipoAccion, 'metodo_pago_cambiado');

  // transferencia -> efectivo limpia el comprobante
  reset({ metodoPago: 'transferencia', comprobanteTransferenciaKey: 'k' });
  res = await patch('efectivo');
  assert.equal(res.status, 200);
  assert.equal(pagos[0].efectivoRecibido, 12.5);
  assert.equal(pagos[0].comprobanteTransferenciaKey, null);

  // mixto: cambiar una parte deja el resumen correcto
  reset();
  pagos.push({ id: 'p2', ordenId: 'o1', metodoPago: 'transferencia', monto: '3', estado: 'CONFIRMADO', createdAt: new Date(), comprobanteTransferenciaKey: null });
  res = await patch('transferencia');
  assert.equal(orden.metodoPago, 'transferencia');

  // rechazos
  reset(); assert.equal((await patch('tarjeta')).status, 400);
  reset(); assert.equal((await patch('efectivo')).status, 400);
  reset(); assert.equal((await patch('transferencia', 'otro')).status, 404);
  reset({ createdAt: new Date(Date.now() - 3 * 86400000) }); assert.equal((await patch('transferencia')).status, 409);
  reset({ estado: 'REEMBOLSADO' }); assert.equal((await patch('transferencia')).status, 409);
  reset(); orden.anulada = true; assert.equal((await patch('transferencia')).status, 409);
  reset(); cajaAbierta = false; assert.equal((await patch('transferencia')).status, 409); cajaAbierta = true;
  reset(); actor = { id: 'm1', nombre: 'Mesero', rol: 'mesero' }; assert.equal((await patch('transferencia')).status, 403);
  assert.equal(pagos[0].metodoPago, 'efectivo');

  console.log('cambio-metodo-pago-route: ok');
}

run().catch((error) => { console.error(error); process.exit(1); });
