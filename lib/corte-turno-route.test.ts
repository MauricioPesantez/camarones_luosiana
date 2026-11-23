import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { Prisma } from '@prisma/client';
import * as cajaTypes from '../types/caja';
import * as cuadreTypes from '../types/cuadre';
import * as retiroTypes from '../types/retiro';
import * as validaciones from './caja-validaciones';
import * as retirosValidaciones from './retiros-validaciones';

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

type Corte = {
  id: string; numero: number; montoContado: number; esperadoDia: number; diferencia: number;
  montoEsperado: number; usuarioId: string; anuladoAt: Date | null; razonAnulacion?: string; createdAt: Date;
};

const PROHIBIDO = /esperado|diferencia|montoCierre|razonAnulacion|beneficiario|motivo/i;

async function run() {
  let actor = { id: 'ana', nombre: 'Ana', rol: 'mesero' };
  let esperadoDia = 150;
  let estado = 'abierta';
  let ordenesHabilitadasAt: string | null = null;
  const cortes: Corte[] = [];
  let filtroSalidas: { createdAt: { gt: Date } } | null = null;
  let encolado: () => Promise<string> = async () => 'encolado';
  const abiertaAt = new Date('2026-11-22T15:00:00Z');

  const caja = () => ({
    id: 'c1', fecha: '2026-11-22', estado, montoInicial: 50, abiertaPorId: 'ana', abiertaPorNombre: 'Ana',
    abiertaPorRol: 'mesero', abiertaAt, montoEsperadoCierre: 250, montoCierre: 247, diferenciaCierre: -3,
    cerradaPorId: null, cerradaPorNombre: null, cerradaAt: null, ordenesHabilitadasAt,
    ordenesHabilitadasPorNombre: ordenesHabilitadasAt && 'Admin', cortes: [...cortes],
  });
  const tx = {
    $queryRaw: async () => [{ id: 'c1', estado, ordenesHabilitadasAt }],
    sesionCaja: { findUnique: async () => caja(), update: async () => { estado = 'cerrada'; return caja(); } },
    historialOrden: { findMany: async () => [] },
    retiroCaja: {
      findMany: async ({ where }: { where: { createdAt: { gt: Date } } }) => {
        filtroSalidas = where;
        return [{ id: 'r1', categoria: 'adelanto', monto: '20.00', usuarioNombre: 'Luis', createdAt: new Date() }];
      },
    },
    corteTurno: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        cortes.some((c) => c.id === where.id) ? { sesionCajaId: 'c1' } : null,
      findMany: async () => cortes,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const corte = {
          id: `k${cortes.length + 1}`, numero: data.numero as number, usuarioId: data.usuarioId as string,
          montoContado: Number(data.montoContado), esperadoDia: Number(data.esperadoDia),
          montoEsperado: Number(data.montoEsperado), diferencia: Number(data.diferencia),
          anuladoAt: null, createdAt: new Date(Date.now() + cortes.length),
        };
        cortes.push(corte);
        return corte;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Corte> }) => {
        Object.assign(cortes.find((c) => c.id === where.id)!, data);
      },
    },
  };
  const prisma = { ...tx, $transaction: async <T>(cb: (c: typeof tx) => Promise<T>) => cb(tx) };
  class CajaNoDisponibleError extends Error {}
  const base = {
    'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    '@prisma/client': { Prisma },
    '@/lib/db': { prisma },
    '@/lib/session': { getAuthenticatedUser: async () => actor },
    '@/lib/caja-validaciones': validaciones,
    '@/lib/retiros-validaciones': retirosValidaciones,
    '@/lib/fecha-ecuador': {
      obtenerFechaEcuador: () => '2026-11-22',
      obtenerRangoEcuador: () => ({ inicio: abiertaAt, fin: abiertaAt }),
    },
    '@/lib/cuadre-server': {
      obtenerDatosCuadre: async () => ({ caja: caja(), ordenes: [], retiros: [], consumosEmpleados: [] }),
      resumirDatosCuadre: () => ({ efectivoEnCaja: esperadoDia, ordenesConSaldoPendiente: 0 }),
    },
    '@/lib/caja': {
      CAJA_SELECT: {}, CajaNoDisponibleError, serializarCaja: (c: ReturnType<typeof caja>) => ({
        ...c, abiertaAt: c.abiertaAt.toISOString(),
        cortes: c.cortes.map((k) => ({ ...k, createdAt: k.createdAt.toISOString() })),
      }),
      obtenerCajaDeHoy: async () => caja(),
      bloquearCajaAbierta: async () => { if (estado !== 'abierta') throw new CajaNoDisponibleError('cerrada'); },
    },
    '@/lib/resumen-cierre': { textosResumenCierre: () => ['x'], ACCIONES_NOVEDAD: [] },
    '@/lib/whatsapp-salidas': { registrarResumenCierre: () => encolado() },
    '@/types/caja': cajaTypes,
    '@/types/cuadre': cuadreTypes,
    '@/types/retiro': retiroTypes,
  };
  type Ruta = Record<'GET' | 'POST' | 'PATCH', (r?: Request) => Promise<Response>>;
  const corteRoute = loadModule<Ruta>('app/api/caja/corte/route.ts', base);
  const cajaRoute = loadModule<Ruta>('app/api/caja/route.ts', base);
  const anularRoute = loadModule<{ PATCH: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    'app/api/caja/corte/[id]/anular/route.ts', base);

  const req = (method: string, body: unknown) => new Request('http://x/api', { method, body: JSON.stringify(body) });
  const cortar = (numero: number, montoContado: number) => corteRoute.POST(req('POST', { numero, montoContado }));
  const anular = (id: string, razon = 'faltaban $20') =>
    anularRoute.PATCH(req('PATCH', { razon }), { params: Promise.resolve({ id }) });
  const ana = () => { actor = { id: 'ana', nombre: 'Ana', rol: 'mesero' }; };
  const luis = () => { actor = { id: 'luis', nombre: 'Luis', rol: 'mesero' }; };
  const admin = () => { actor = { id: 'adm', nombre: 'Admin', rol: 'admin' }; };

  // Salidas del turno: de todos, desde la apertura, sin motivo ni beneficiario.
  let res = await corteRoute.GET();
  assert.equal(res.status, 200);
  assert.equal(filtroSalidas!.createdAt.gt, abiertaAt);
  assert.doesNotMatch(JSON.stringify(await res.json()), PROHIBIDO);

  // Adelanto de $20 sin registrar: se guarda -20, pero Ana no lo ve.
  res = await cortar(1, 130);
  assert.equal(res.status, 201);
  assert.doesNotMatch(JSON.stringify(await res.json()), PROHIBIDO);
  assert.equal(cortes[0].diferencia, -20);

  // Doble clic o segundo intento: rechazado sin culpar a otro mesero.
  for (const numero of [1, 2]) {
    res = await cortar(numero, 150);
    assert.equal(res.status, 409);
    assert.match((await res.json()).error, /Ya entregaste tu turno/);
  }

  // El mesero no anula; el admin sí, con motivo.
  assert.equal((await anular('k1')).status, 403);
  admin();
  assert.equal((await anular('k1', ' ')).status, 400);
  assert.equal((await anular('nada')).status, 404);
  assert.equal((await anular('k1')).status, 200);
  assert.equal((await anular('k1')).status, 409);

  // La caja del mesero no trae el cuadre ni la razón; la del admin sí.
  ana();
  res = await cajaRoute.GET(new Request('http://x/api/caja'));
  assert.doesNotMatch(JSON.stringify(await res.json()), PROHIBIDO);
  actor = { id: 'coc', nombre: 'Cocina', rol: 'cocina' };
  res = await cajaRoute.GET(new Request('http://x/api/caja'));
  assert.doesNotMatch(JSON.stringify(await res.json()), PROHIBIDO);
  admin();
  const completa = (await (await cajaRoute.GET(new Request('http://x/api/caja'))).json()).caja;
  assert.equal(completa.cortes[0].diferencia, -20);
  assert.equal(completa.diferenciaCierre, -3);

  // Registrado el adelanto, el reconteo cuadra: no aparece el sobrante falso.
  ana();
  esperadoDia = 130;
  await corteRoute.GET();
  assert.equal(filtroSalidas!.createdAt.gt, abiertaAt);
  assert.equal((await cortar(1, 130)).status, 409); // el número anulado no se reutiliza
  assert.equal((await cortar(2, 130)).status, 201);
  assert.equal(cortes[1].diferencia, 0);

  // Otro mesero continúa; solo el último corte vigente se anula.
  luis();
  esperadoDia = 190;
  assert.equal((await cortar(3, 190)).status, 201);
  assert.equal(cortes[2].diferencia, 0);
  ana();
  assert.equal((await cortar(4, 190)).status, 201);
  admin();
  assert.equal((await anular('k2')).status, 409);

  // Mostradas las órdenes, nadie entrega otro conteo ni se anula el que hay.
  ordenesHabilitadasAt = '2026-11-23T03:00:00.000Z';
  res = await anular('k4');
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /órdenes del día/);
  luis();
  res = await cortar(5, 200);
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /órdenes del día/);
  assert.equal(cortes.length, 4);
  // El mesero sabe que hay órdenes por ver, no quién las habilitó.
  res = await cajaRoute.GET(new Request('http://x/api/caja'));
  const habilitada = (await res.json()).caja;
  assert.equal(habilitada.ordenesHabilitadasAt, ordenesHabilitadasAt);
  assert.equal('ordenesHabilitadasPorNombre' in habilitada, false);
  admin();

  // Un fallo de WhatsApp no impide cerrar, y se avisa.
  encolado = async () => { throw new Error('sin base'); };
  const errorOriginal = console.error;
  console.error = () => {};
  res = await cajaRoute.PATCH(req('PATCH', { fecha: '2026-11-22', montoCierre: 190 }));
  console.error = errorOriginal;
  assert.equal(res.status, 200);
  assert.equal(estado, 'cerrada');
  assert.equal((await res.json()).resumenWhatsapp, 'error');
  assert.equal((await anular('k4')).status, 409);

  // Con éxito se informa el encolado.
  estado = 'abierta';
  encolado = async () => 'encolado';
  res = await cajaRoute.PATCH(req('PATCH', { fecha: '2026-11-22', montoCierre: 190 }));
  assert.equal((await res.json()).resumenWhatsapp, 'encolado');

  console.log('corte-turno-route: ok');
}

run().catch((error) => { console.error(error); process.exit(1); });
