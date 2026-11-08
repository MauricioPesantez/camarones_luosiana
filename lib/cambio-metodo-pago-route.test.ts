import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as ordenTypes from '../types/orden';

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

type Orden = { tipoOrden: string; anulada: boolean; estado: string; metodoPagoPrevisto: string | null; montoPagado: number };

async function run() {
  let actor: { id: string; nombre: string; rol: string } | null = { id: 'a1', nombre: 'Admin', rol: 'admin' };
  let orden: Orden | null = null;
  let cobroEnCarrera = false;
  const historial: Array<Record<string, unknown>> = [];

  const tx = {
    orden: {
      updateMany: async ({ where, data }: { where: Partial<Orden>; data: Partial<Orden> }) => {
        if (cobroEnCarrera && orden) orden.montoPagado = 5;
        const coincide = orden && Object.entries(where).every(([k, v]) => k === 'id' || orden?.[k as keyof Orden] === v);
        if (!coincide) return { count: 0 };
        orden = { ...orden!, ...data };
        return { count: 1 };
      },
    },
    historialOrden: { create: async ({ data }: { data: Record<string, unknown> }) => { historial.push(data); } },
  };
  const route = loadModule<{ PATCH: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'app/api/admin/ordenes/[id]/metodo-pago/route.ts',
    {
      'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      '@/lib/db': {
        prisma: {
          orden: { findUnique: async () => (orden ? { ...orden } : null) },
          $transaction: async <T>(cb: (c: typeof tx) => Promise<T>) => cb(tx),
        },
      },
      '@/lib/session': { getAuthenticatedUser: async () => actor },
      '@/types/orden': ordenTypes,
    },
  );
  const patch = (metodoPago: unknown) =>
    route.PATCH(
      new Request('http://x', { method: 'PATCH', body: JSON.stringify({ metodoPago }) }),
      { params: Promise.resolve({ id: 'o1' }) },
    );
  const reset = (extra: Partial<Orden> = {}) => {
    orden = { tipoOrden: 'domicilio', anulada: false, estado: 'en_preparacion', metodoPagoPrevisto: 'efectivo', montoPagado: 0, ...extra };
    historial.length = 0;
    cobroEnCarrera = false;
  };

  // efectivo -> transferencia mientras se prepara, queda en el historial
  reset();
  let res = await patch('transferencia');
  assert.equal(res.status, 200);
  assert.equal(orden!.metodoPagoPrevisto, 'transferencia');
  assert.equal(historial[0].tipoAccion, 'metodo_pago_cambiado');

  // y de vuelta
  res = await patch('efectivo');
  assert.equal(res.status, 200);
  assert.equal(orden!.metodoPagoPrevisto, 'efectivo');

  // rechazos
  reset(); assert.equal((await patch('tarjeta')).status, 400);
  reset(); assert.equal((await patch('efectivo')).status, 400);
  reset({ tipoOrden: 'local', metodoPagoPrevisto: null }); assert.equal((await patch('transferencia')).status, 400);
  reset({ anulada: true }); assert.equal((await patch('transferencia')).status, 409);
  reset({ montoPagado: 10 }); assert.equal((await patch('transferencia')).status, 409);
  reset(); cobroEnCarrera = true; assert.equal((await patch('transferencia')).status, 409);
  assert.equal(historial.length, 0);
  orden = null; assert.equal((await patch('transferencia')).status, 404);
  reset(); actor = { id: 'm1', nombre: 'Mesero', rol: 'mesero' }; assert.equal((await patch('transferencia')).status, 403);
  assert.equal(orden!.metodoPagoPrevisto, 'efectivo');

  console.log('cambio-metodo-pago-route: ok');
}

run().catch((error) => { console.error(error); process.exit(1); });
