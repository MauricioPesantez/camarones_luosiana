import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as fechaEcuador from './fecha-ecuador';
import * as bitacoraModulo from './bitacora-revision';
import { armarBitacora, type FilaBitacora } from './bitacora-revision';
import * as revisionTypes from '../types/revision';
import type { DetalleRevision, RevisionGuardada } from '../types/revision';
import type { OrdenAdmin } from '../components/admin/orden-admin';
import type { OrdenRevisable } from '../types/revision';

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

// OrdenAdmin debe servir como OrdenRevisable sin conversiones.
const _compatible = (o: OrdenAdmin): OrdenRevisable => o;
void _compatible;

const item = (id: string, cantidad = 1) => ({
  id, cantidad, precioUnitario: 2, producto: { nombre: 'Cola' },
});
const orden = (extra: Partial<FilaBitacora['orden']> = {}): FilaBitacora['orden'] => ({
  id: 'o1', numeroDiario: 34, createdAt: new Date('2026-11-23T15:00:00Z'),
  creadorNombre: 'Ana', cobradaPor: 'Luis', anulada: false, estado: 'cobrada',
  total: 2, items: [item('i1')],
  pagos: [{ metodoPago: 'efectivo', monto: 2 }], ...extra,
});
const detalle = (extra: Partial<DetalleRevision> = {}): DetalleRevision => ({
  productos: [], faltantes: [], cobro: null, total: null, itemsVistos: ['i1'], ...extra,
});
const revision = (d: DetalleRevision): RevisionGuardada => ({
  ordenId: 'o1', detalle: d, revisada: true, conErrores: true, version: 2,
  revisadaPorNombre: 'Admin', revisadaAt: '2026-11-23T20:00:00.000Z',
});
const faltoCola = { faltantes: [{ productoId: 'p1', nombre: 'Cola', cantidad: 1, precio: 1 }] };
const cobroMal = { cobro: { sistema: [{ metodoPago: 'transferencia', monto: 2 }], estado: 'efectivo' as const } };

function pruebaPura() {
  const vacia = armarBitacora([]);
  assert.deepEqual(vacia, {
    ordenesRevisadas: 0,
    porTipo: { falto: 0, no_iba: 0, cantidad: 0, metodo: 0, total: 0 },
    porPersona: [], errores: [],
  });

  const filas: FilaBitacora[] = [
    // Antigua: falto (Ana) + método (Luis); la foto de cobro ya no coincide con los pagos.
    { orden: orden({ id: 'a', numeroDiario: 1, createdAt: new Date('2026-11-22T15:00:00Z') }),
      revision: revision(detalle({ ...faltoCola, ...cobroMal })) },
    // Reciente, sin cobrador: el error de cobro va al creador. 02:30Z del 24 = 23 en Ecuador.
    { orden: orden({ id: 'b', numeroDiario: 2, createdAt: new Date('2026-11-24T02:30:00Z'), cobradaPor: null,
        pagos: [{ metodoPago: 'transferencia', monto: 2 }] }),
      revision: revision(detalle({ ...faltoCola, ...cobroMal,
        total: { sistema: 2, estado: 'de_mas', diferencia: 1 } })) },
    // Revisada sin errores: cuenta como revisada, no aporta errores.
    { orden: orden({ id: 'c', numeroDiario: null }), revision: revision(detalle()) },
  ];
  // Manda quien figuraba al anotarlo, no quien cobró después.
  const [deQuien] = armarBitacora([{ orden: orden({ cobradaPor: 'Admin' }),
    revision: revision(detalle({ ...cobroMal, personas: { 'metodo::Transferencia registrada, fue efectivo': 'Luis' } })) }]).errores;
  assert.equal(deQuien.persona, 'Luis');

  // Un error anterior se cuenta y se avisa, aunque la foto ya coincida con la orden.
  const [anterior] = armarBitacora([{ orden: orden({ pagos: [{ metodoPago: 'efectivo', monto: 2 }] }),
    revision: revision(detalle({ anteriores: [{ clave: 'x', tipo: 'metodo', texto: 'Antes', de: 'cobrador' }] })) }]).errores;
  assert.deepEqual([anterior.texto, anterior.persona, anterior.cambio], ['Antes', 'Luis', true]);

  const b = armarBitacora(filas);
  assert.equal(b.ordenesRevisadas, 3);
  assert.deepEqual(b.porTipo, { falto: 2, no_iba: 0, cantidad: 0, metodo: 2, total: 1 });
  assert.deepEqual(b.errores.map((e) => [e.ordenId, e.tipo, e.persona, e.fecha, e.cambio]), [
    ['b', 'falto', 'Ana', '2026-11-23', false],
    ['b', 'metodo', 'Ana', '2026-11-23', false],
    ['b', 'total', 'Ana', '2026-11-23', false],
    ['a', 'falto', 'Ana', '2026-11-22', true],
    ['a', 'metodo', 'Luis', '2026-11-22', true],
  ]);
  assert.equal(b.errores[0]!.texto, 'Faltó 1× Cola');
  assert.equal(b.errores[0]!.numeroDiario, 2);
  assert.deepEqual(b.porPersona.map((p) => [p.nombre, p.total]), [['Ana', 4], ['Luis', 1]]);
  assert.deepEqual(b.porPersona[1]!.porTipo, { falto: 0, no_iba: 0, cantidad: 0, metodo: 1, total: 0 });

  // Cobrador vacío o solo espacios... vacío cae al creador; empate de errores por nombre.
  const e = armarBitacora([
    { orden: orden({ cobradaPor: '', creadorNombre: 'Zoe' }), revision: revision(detalle(cobroMal)) },
    { orden: orden({ id: 'z', cobradaPor: 'Bea' }), revision: revision(detalle(cobroMal)) },
  ]);
  assert.deepEqual(e.porPersona.map((p) => p.nombre), ['Bea', 'Zoe']);
}

async function pruebaRuta() {
  let actor: { id: string; nombre: string; rol: string } | null = null;
  const consultas: Array<Record<string, unknown>> = [];
  let filasDb: unknown[] = [];
  const routeHolder: { proyectar?: () => Promise<unknown[]> } = {};
  const route = loadModule<{ GET: (r: Request) => Promise<Response> }>(
    'app/api/admin/reportes/revision/route.ts',
    {
      'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
      '@/lib/db': { prisma: { revisionOrden: { findMany: async (q: Record<string, unknown>) => { consultas.push(q); return routeHolder.proyectar ? routeHolder.proyectar() : filasDb; } } } },
      '@/lib/session': { getAuthenticatedUser: async () => actor },
      '@/lib/fecha-ecuador': fechaEcuador,
      '@/lib/bitacora-revision': bitacoraModulo,
      '@/types/revision': revisionTypes,
    },
  );
  const get = (qs: string) => route.GET(new Request(`http://x/api/admin/reportes/revision${qs}`));
  const ok = '?fechaInicio=2026-11-22&fechaFin=2026-11-23';

  assert.equal((await get(ok)).status, 401);
  actor = { id: 'm', nombre: 'Ana', rol: 'mesero' };
  assert.equal((await get(ok)).status, 403);
  actor = { id: 'a', nombre: 'Admin', rol: 'admin' };
  for (const qs of ['', '?fechaInicio=2026-11-22', '?fechaInicio=2026-02-31&fechaFin=2026-03-01',
    '?fechaInicio=2026-11-22&fechaFin=basura', '?fechaInicio=2026-11-23&fechaFin=2026-11-22'])
    assert.equal((await get(qs)).status, 400, qs);
  assert.equal(consultas.length, 0);

  const fila = (id: string, extra: Record<string, unknown> = {}, d: DetalleRevision = detalle(faltoCola)) => ({
    ordenId: id, detalle: d, revisada: true, conErrores: true, version: 1,
    revisadaPorNombre: 'Admin', revisadaAt: new Date('2026-11-23T20:00:00Z'),
    orden: { id, numeroDiario: 3, createdAt: new Date('2026-11-23T15:00:00Z'), mesero: 'Ana',
      creador: null, cobradaPor: null, tipoOperacion: 'VENTA_CLIENTE', empleadoId: null, anulada: false,
      estado: 'cobrada', total: '2', items: [item('i1')], pagos: [], ...extra },
  });
  const pago = (metodoPago: string, monto: string, estado = 'CONFIRMADO') => ({ metodoPago, monto, estado });
  // La base simulada respeta el select de pagos: sin `estado` no se puede saber qué se reembolsó.
  let rows: ReturnType<typeof fila>[] = [];
  filasDb = [];
  const consultar = async () => {
    const q = consultas[consultas.length - 1] as { select: { orden: { select: { pagos: { select: Record<string, boolean> } } } } };
    const campos = q.select.orden.select.pagos.select;
    return rows.map((r) => ({ ...r, orden: { ...r.orden, pagos: (r.orden.pagos as Record<string, unknown>[]).map(
      (p) => Object.fromEntries(Object.entries(p).filter(([k]) => campos[k])) ) } }));
  };
  routeHolder.proyectar = consultar;

  // Una de cada clase que no se revisa, una venta a cuenta de empleado y una normal.
  rows = [
    fila('anulada', { anulada: true }),
    fila('cancelada', { estado: 'cancelada' }),
    fila('stock', { estado: 'pendiente_aprobacion_stock' }),
    fila('consumo', { tipoOperacion: 'CONSUMO_EMPLEADO', empleadoId: 'e1' }),
    fila('cuenta', { empleadoId: 'e1', total: '0' }),
    fila('normal'),
  ];
  let res = await get(ok);
  assert.equal(res.status, 200);
  let cuerpo = await res.json();
  assert.equal(cuerpo.ordenesRevisadas, 2);
  assert.deepEqual(cuerpo.errores.map((e: { ordenId: string }) => e.ordenId).sort(), ['cuenta', 'normal']);
  assert.equal(cuerpo.porPersona[0].nombre, 'Ana'); // creador ausente: cae al mesero

  // Un pago reembolsado y uno confirmado: la orden no cambió. Dos métodos (mixto): tampoco.
  const cobroEf = { sistema: [{ metodoPago: 'efectivo', monto: 2 }], estado: 'transferencia' as const };
  const cobroMixto = { sistema: [{ metodoPago: 'efectivo', monto: 1 }, { metodoPago: 'transferencia', monto: 1 }], estado: 'efectivo' as const };
  rows = [
    fila('reembolso', { pagos: [pago('efectivo', '2'), pago('transferencia', '2', 'REEMBOLSADO')] }, detalle({ cobro: cobroEf })),
    fila('mixto', { pagos: [pago('efectivo', '1'), pago('transferencia', '1')] }, detalle({ cobro: cobroMixto })),
  ];
  res = await get(ok);
  cuerpo = await res.json();
  assert.deepEqual(cuerpo.errores.map((e: { tipo: string; cambio: boolean }) => [e.tipo, e.cambio]), [['metodo', false], ['metodo', false]]);
  assert.ok('estado' in (consultas[consultas.length - 1] as { select: { orden: { select: { pagos: { select: object } } } } }).select.orden.select.pagos.select);

  type Consulta = { where: { revisada: boolean; orden: { anulada: boolean; createdAt: { gte: Date; lt: Date } } }; select: unknown };
  const { where, select } = consultas[0] as unknown as Consulta;
  assert.equal(where.revisada, true);
  assert.equal(where.orden.anulada, false);
  assert.equal(where.orden.createdAt.gte.toISOString(), '2026-11-22T05:00:00.000Z');
  assert.equal(where.orden.createdAt.lt.toISOString(), '2026-11-24T05:00:00.000Z');
  const texto = JSON.stringify(select);
  for (const privado of ['nombreCliente', 'telefonoCliente', 'direccion']) assert.ok(!texto.includes(privado), privado);
}

async function pruebaCuadre() {
  const datos = { fecha: '2026-11-23', ordenes: [{ id: 'o1' }, { id: 'o2' }], retiros: [], caja: null };
  let consulta: { where: unknown } | null = null;
  const fila = {
    id: 'interno', ordenId: 'o1', detalle: detalle(), revisada: true, conErrores: false, version: 1,
    revisadaPorId: 'u1', revisadaPorNombre: 'Admin', revisadaAt: new Date('2026-11-23T20:00:00Z'),
    createdAt: new Date(), updatedAt: new Date(),
  };
  let filas: unknown[] = [fila, { ...fila, ordenId: 'o2', revisadaAt: null, revisada: false }];
  let actor: { rol: string } | null = { rol: 'admin' };
  const route = loadModule<{ GET: (r: Request) => Promise<Response> }>('app/api/admin/cuadre/route.ts', {
    'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    '@/lib/cuadre-server': { obtenerDatosCuadre: async () => datos },
    '@/lib/session': { getAuthenticatedUser: async () => actor },
    '@/lib/db': { prisma: { revisionOrden: { findMany: async (q: { where: unknown }) => { consulta = q; return filas; } } } },
  });
  const res = await route.GET(new Request('http://x/api/admin/cuadre?fecha=2026-11-23'));
  assert.equal(res.status, 200);
  const { revisiones, ...resto } = await res.json();
  assert.deepEqual(resto, datos);
  assert.deepEqual(consulta!.where, { ordenId: { in: ['o1', 'o2'] } });
  assert.equal(revisiones.length, 2);
  assert.equal(revisiones[0].revisadaAt, '2026-11-23T20:00:00.000Z');
  assert.equal(revisiones[1].revisadaAt, null);
  for (const r of revisiones) {
    assert.deepEqual(Object.keys(r).sort(),
      ['conErrores', 'detalle', 'ordenId', 'revisada', 'revisadaAt', 'revisadaPorNombre', 'version']);
  }
  filas = [];
  actor = null;
  assert.equal((await route.GET(new Request('http://x/api/admin/cuadre?fecha=2026-11-23'))).status, 401);
}

function pruebaPrivacidad() {
  // La relación en Orden se llama `revision`: pedirla también filtraría las anotaciones.
  const patron = /revisionOrden|\brevision:\s*(true|\{)/i;
  assert.ok(patron.test('include: { items: true, revision: true }'));
  const propios = new Set([
    'app/api/admin/ordenes/[id]/revision/route.ts',
    'app/api/admin/reportes/revision/route.ts',
    'app/api/admin/cuadre/route.ts',
    'lib/bitacora-revision.ts',
    'lib/db.ts',
  ]);
  const archivos = ['app/api', 'lib']
    .flatMap((dir) => readdirSync(resolve(dir), { recursive: true, encoding: 'utf8' }).map((f) => join(dir, f)))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !propios.has(f));
  for (const f of ['lib/ordenes-mesero.ts', 'app/api/ordenes/route.ts', 'app/api/ordenes/[id]/historial/route.ts'])
    assert.ok(archivos.includes(f), `El barrido no llega a ${f}`);
  for (const f of archivos)
    assert.ok(!patron.test(readFileSync(resolve(f), 'utf8')), `${f} lee la bitácora de revisión`);
}

(async () => {
  pruebaPura();
  await pruebaRuta();
  await pruebaCuadre();
  pruebaPrivacidad();
  console.log('bitacora-revision: ok');
})().catch((error) => { console.error(error); process.exit(1); });
