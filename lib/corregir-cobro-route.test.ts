import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as cajaTypes from '../types/caja';
import * as cobroTypes from '../types/cobro';
import * as ordenTypes from '../types/orden';
import * as fechaEcuador from './fecha-ecuador';

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

type Pago = {
  id: string; metodoPago: string; monto: string; estado: string; createdAt: Date;
  efectivoRecibido?: number; transferenciaRecibida?: number; comprobanteTransferenciaKey?: string | null;
};
type Orden = {
  id: string; tipoOperacion: string; empleadoId: string | null; anulada: boolean; estado: string;
  metodoPago: string; pagos: Pago[];
};

async function run() {
  let actor: { id: string; nombre: string; rol: string } | null = null;
  let orden: Orden | null = null;
  let estadoCaja: string | undefined = 'abierta';
  let fechaBloqueada = '';
  let perderCarrera = false;
  const historial: Array<Record<string, unknown>> = [];

  const tx = {
    $queryRaw: async (_sql: TemplateStringsArray, fecha: string) => {
      fechaBloqueada = fecha;
      return estadoCaja ? [{ estado: estadoCaja }] : [];
    },
    orden: {
      findUnique: async () => structuredClone(orden),
      update: async ({ data }: { data: Partial<Orden> }) => Object.assign(orden!, data),
    },
    cobro: {
      updateMany: async ({ where, data }: { where: Partial<Pago>; data: Partial<Pago> }) => {
        const pago = orden!.pagos.find((p) =>
          Object.entries(where).every(([k, v]) => k === 'ordenId' || p[k as keyof Pago] === v));
        if (!pago || perderCarrera) return { count: 0 };
        Object.assign(pago, data);
        return { count: 1 };
      },
    },
    historialOrden: { create: async ({ data }: { data: Record<string, unknown> }) => { historial.push(data); } },
  };
  const route = loadModule<{ PATCH: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'app/api/admin/ordenes/[id]/corregir-cobro/route.ts',
    {
      'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      '@/lib/db': { prisma: { ...tx, $transaction: async <T>(cb: (c: typeof tx) => Promise<T>) => cb(tx) } },
      '@/lib/fecha-ecuador': fechaEcuador,
      '@/lib/session': { getAuthenticatedUser: async () => actor },
      '@/types/caja': cajaTypes,
      '@/types/cobro': cobroTypes,
      '@/types/orden': ordenTypes,
    },
  );
  const corregir = (metodoPago: unknown, razon: unknown = 'llegó por banco') =>
    route.PATCH(
      new Request('http://x', { method: 'PATCH', body: JSON.stringify({ metodoPago, razon }) }),
      { params: Promise.resolve({ id: 'o1' }) },
    );
  // 02:30 UTC del 24 es todavía el 23 en Ecuador: se bloquea la caja del día del cobro.
  const pagoBase = (extra: Partial<Pago> = {}): Pago => ({
    id: 'p1', metodoPago: 'efectivo', monto: '12.50', estado: 'CONFIRMADO',
    createdAt: new Date('2026-11-24T02:30:00Z'), comprobanteTransferenciaKey: 'k', ...extra,
  });
  const reset = (extra: Partial<Orden> = {}) => {
    actor = { id: 'a1', nombre: 'Admin', rol: 'admin' };
    orden = {
      id: 'o1', tipoOperacion: 'VENTA_CLIENTE', empleadoId: null, anulada: false, estado: 'cobrada',
      metodoPago: 'efectivo', pagos: [pagoBase()], ...extra,
    };
    estadoCaja = 'abierta';
    perderCarrera = false;
    historial.length = 0;
  };

  // Efectivo -> transferencia: cambia el cobro y la orden; conserva hora y comprobante.
  reset();
  let res = await corregir('transferencia', '  llegó por banco  ');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { orden: { id: 'o1', metodoPago: 'transferencia' }, cobroId: 'p1' });
  assert.equal(fechaBloqueada, '2026-11-23');
  assert.deepEqual(orden!.pagos[0], pagoBase({
    metodoPago: 'transferencia', efectivoRecibido: 0, transferenciaRecibida: 12.5,
  }));
  assert.equal(orden!.metodoPago, 'transferencia');
  assert.equal(historial[0].tipoAccion, 'cobro_corregido');
  assert.equal(historial[0].descripcion, 'Cobro de $12.50 corregido de efectivo a transferencia');
  assert.equal(historial[0].razon, 'llegó por banco');
  assert.equal(historial[0].usuarioNombre, 'Admin');

  // Y de vuelta.
  assert.equal((await corregir('efectivo')).status, 200);
  assert.equal(orden!.pagos[0].efectivoRecibido, 12.5);
  assert.equal(orden!.pagos[0].transferenciaRecibida, 0);

  // Rechazos: nada cambia.
  const rechaza = async (estado: number, preparar: () => void, metodo: unknown = 'transferencia', razon?: unknown) => {
    reset();
    preparar();
    res = await (razon === undefined ? corregir(metodo) : corregir(metodo, razon));
    assert.equal(res.status, estado, JSON.stringify(await res.json()));
    assert.equal(historial.length, 0);
    if (orden) assert.equal(orden.metodoPago, 'efectivo');
  };
  const nada = () => {};
  await rechaza(401, () => { actor = null; });
  await rechaza(403, () => { actor = { id: 'm', nombre: 'Ana', rol: 'mesero' }; });
  await rechaza(400, nada, 'tarjeta');
  await rechaza(400, nada, 'transferencia', '  ');
  await rechaza(400, nada, 'transferencia', 5);
  await rechaza(409, nada, 'efectivo');
  await rechaza(404, () => { orden = null; });
  await rechaza(409, () => { orden!.anulada = true; });
  await rechaza(409, () => { orden!.estado = 'cancelada'; });
  await rechaza(409, () => { orden!.empleadoId = 'e1'; });
  await rechaza(409, () => { orden!.tipoOperacion = 'CONSUMO_EMPLEADO'; });
  await rechaza(409, () => { orden!.pagos = []; });
  await rechaza(409, () => { orden!.pagos.push(pagoBase({ id: 'p2', metodoPago: 'transferencia' })); });
  await rechaza(409, () => { orden!.pagos[0].estado = 'REEMBOLSO_PENDIENTE'; });
  await rechaza(409, () => { estadoCaja = 'cerrada'; });
  await rechaza(409, () => { estadoCaja = undefined; });
  await rechaza(409, () => { perderCarrera = true; });

  console.log('corregir-cobro-route: ok');
}

run().catch((error) => { console.error(error); process.exit(1); });
