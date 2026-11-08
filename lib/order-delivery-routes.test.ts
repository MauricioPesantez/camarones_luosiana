import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as location from './delivery-location';

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

type OrdenPrueba = Record<string, unknown> | null;
const base = {
  id: 'orden-1', tipoOrden: 'domicilio', tipoOperacion: 'VENTA_CLIENTE', anulada: false, estado: 'pendiente',
  creadorId: 'digital-1', mesero: 'Digital', cobrada: false, ubicacionUrl: null, referenciaEntrega: null,
  deliverySolicitadoAt: null,
};
// Regla real de lib/order-payment.ts, que importa Prisma y no se carga aquí.
const canUserModifyOrder = (
  user: { id: string; nombre: string; rol: string },
  order: { creadorId?: string | null; mesero: string },
) => user.rol === 'admin' || order.creadorId === user.id || (!order.creadorId && order.mesero === user.nombre);
const digital = { id: 'digital-1', nombre: 'Digital', rol: 'digital' };
const admin = { id: 'admin-1', nombre: 'Admin', rol: 'admin' };

async function run() {
  let actor: typeof digital | null = null;
  let orden: OrdenPrueba = { ...base };
  let carrera = false;
  const historial: Array<Record<string, unknown>> = [];

  const tx = {
    orden: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const coincide = orden && Object.entries(where).every(([campo, valor]) => orden?.[campo] === valor);
        if (carrera || !coincide) return { count: 0 };
        orden = { ...orden, ...data };
        return { count: 1 };
      },
    },
    historialOrden: {
      create: async ({ data }: { data: Record<string, unknown> }) => { historial.push(data); return { id: 'h1' }; },
    },
  };
  const prisma = {
    orden: {
      findUnique: async () => {
        if (carrera && orden) orden = { ...orden, deliverySolicitadoAt: orden.deliverySolicitadoAt ?? new Date(0) };
        return orden;
      },
    },
    $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx),
  };
  const dependencias = {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/db': { prisma },
    '@/lib/session': { getAuthenticatedUser: async () => actor },
    '@/lib/order-payment': { canUserModifyOrder },
    '@/lib/delivery-location': location,
    // Las salidas de WhatsApp se prueban contra PostgreSQL en whatsapp-orden.postgres.test.ts.
    '@/lib/whatsapp-salidas': { cancelarRecordatorios: async () => {}, registrarUbicacionWhatsapp: async () => {} },
  };
  type Ruta = { PATCH: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> };
  const ubicacion = loadModule<Ruta>('app/api/ordenes/[id]/ubicacion/route.ts', dependencias);
  const delivery = loadModule<Ruta>('app/api/ordenes/[id]/delivery/route.ts', dependencias);
  const context = { params: Promise.resolve({ id: 'orden-1' }) };
  const pedir = (ruta: Ruta, body: object) => ruta.PATCH(new Request('http://test.invalid/api', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), context);
  const actual = () => orden as Record<string, unknown>;
  const reiniciar = (cambios = {}) => { orden = { ...base, ...cambios }; historial.length = 0; carrera = false; };

  const enlace = 'https://maps.app.goo.gl/AbC123';
  const cambio = { ubicacionUrl: enlace, referenciaEntrega: 'Casa azul' };

  // Ubicación: acceso.
  assert.equal((await pedir(ubicacion, cambio)).status, 401);
  actor = { id: 'mesero-2', nombre: 'Otro', rol: 'mesero' };
  assert.equal((await pedir(ubicacion, cambio)).status, 403);
  actor = digital;
  orden = null;
  assert.equal((await pedir(ubicacion, cambio)).status, 404);

  // Ubicación: datos y orden elegible.
  reiniciar();
  assert.equal((await pedir(ubicacion, { ...cambio, ubicacionUrl: 'http://evil.test' })).status, 400);
  assert.equal((await pedir(ubicacion, { ...cambio, ubicacionUrl: 42 })).status, 400);
  assert.equal((await pedir(ubicacion, {})).status, 400, 'Un cuerpo incompleto no borra la ubicación');
  assert.equal((await pedir(ubicacion, { ...cambio, referenciaEntrega: 'a'.repeat(501) })).status, 400);
  for (const cambios of [{ tipoOrden: 'para_llevar' }, { anulada: true }, { tipoOperacion: 'CONSUMO_EMPLEADO' }]) {
    reiniciar(cambios);
    assert.equal((await pedir(ubicacion, cambio)).status, 409);
    assert.equal(historial.length, 0);
  }

  // Ubicación: guarda y audita el cambio.
  reiniciar();
  const guardada = await pedir(ubicacion, { ubicacionUrl: ` ${enlace} `, referenciaEntrega: ' Casa azul ' });
  assert.equal(guardada.status, 200);
  assert.deepEqual(await guardada.json(), cambio);
  assert.equal(actual().ubicacionUrl, enlace);
  assert.equal(historial.length, 1);
  assert.equal(historial[0].tipoAccion, 'ubicacion_actualizada');
  assert.equal(historial[0].usuarioNombre, digital.nombre);
  assert.equal(historial[0].usuarioRol, digital.rol);
  assert.deepEqual(historial[0].datosAntes, { ubicacionUrl: null, referenciaEntrega: null });
  assert.deepEqual(historial[0].datosDespues, cambio);

  // Sin cambios no ensucia el historial; vaciar sí se audita.
  assert.equal((await pedir(ubicacion, cambio)).status, 200);
  assert.equal(historial.length, 1);
  actor = admin;
  assert.equal((await pedir(ubicacion, { ubicacionUrl: null, referenciaEntrega: '' })).status, 200);
  assert.equal(actual().ubicacionUrl, null);
  assert.equal(historial.length, 2);

  // Dos ediciones simultáneas: la segunda no pisa la primera en silencio.
  reiniciar();
  actor = digital;
  carrera = true;
  assert.equal((await pedir(ubicacion, cambio)).status, 409);
  assert.equal(historial.length, 0);

  // Delivery: solo el creador digital o un administrador.
  reiniciar();
  actor = null;
  assert.equal((await pedir(delivery, { accion: 'solicitar' })).status, 401);
  actor = { id: 'mesero-1', nombre: 'Mesero', rol: 'mesero' };
  reiniciar({ creadorId: 'mesero-1' });
  assert.equal((await pedir(delivery, { accion: 'solicitar' })).status, 403);
  actor = { id: 'digital-2', nombre: 'Otro', rol: 'digital' };
  reiniciar();
  assert.equal((await pedir(delivery, { accion: 'solicitar' })).status, 403);
  actor = digital;
  assert.equal((await pedir(delivery, { accion: 'otra' })).status, 400);
  orden = null;
  assert.equal((await pedir(delivery, { accion: 'solicitar' })).status, 404);

  // Programar la moto: la hora se valida antes de tocar la orden.
  reiniciar();
  const enMin = (min: number) => new Date(Date.now() + min * 60 * 1000).toISOString();
  for (const hora of [undefined, 'no-es-hora', enMin(-5), enMin(13 * 60)]) {
    assert.equal((await pedir(delivery, { accion: 'programar', hora })).status, 400, String(hora));
  }
  assert.equal(historial.length, 0);

  // Delivery: orden elegible, independiente del pago.
  for (const cambios of [
    { tipoOrden: 'local' }, { anulada: true }, { tipoOperacion: 'CONSUMO_EMPLEADO' },
    { estado: 'cancelada' }, { estado: 'pendiente_aprobacion_stock' },
  ]) {
    reiniciar(cambios);
    assert.equal((await pedir(delivery, { accion: 'solicitar' })).status, 409);
  }
  reiniciar({ cobrada: true, estado: 'cobrada' });
  const solicitado = await pedir(delivery, { accion: 'solicitar' });
  assert.equal(solicitado.status, 200);
  const { deliverySolicitadoAt } = await solicitado.json();
  assert.ok(deliverySolicitadoAt);
  assert.equal(actual().estado, 'cobrada', 'No cambia estado ni pago');
  assert.equal(actual().cobrada, true);
  assert.equal(historial.length, 1);
  assert.equal(historial[0].tipoAccion, 'delivery_solicitado');
  assert.equal(historial[0].usuarioNombre, digital.nombre);

  // Delivery: idempotente, incluso entre dos solicitudes simultáneas.
  const repetido = await pedir(delivery, { accion: 'solicitar' });
  assert.equal(repetido.status, 200);
  assert.equal((await repetido.json()).deliverySolicitadoAt, deliverySolicitadoAt);
  assert.equal(historial.length, 1);
  reiniciar();
  actor = admin;
  carrera = true;
  const simultaneo = await pedir(delivery, { accion: 'solicitar' });
  assert.equal(simultaneo.status, 200);
  assert.equal((await simultaneo.json()).deliverySolicitadoAt, new Date(0).toISOString());
  assert.equal(historial.length, 0);

  console.log('order-delivery routes tests: ok');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
