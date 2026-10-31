import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { Prisma } from '@prisma/client';
import * as ordenTypes from '../types/orden';
import * as cajaTypes from '../types/caja';
import * as cobroTypes from '../types/cobro';
import * as fechas from './fecha-ecuador';
import * as dailyNumber from './daily-order-number';

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

async function run() {
  let rol = 'mesero';
  let estadoCaja: string | null = null;
  let cajaCierraDuranteCreacion = false;
  let conflictoStock = false;
  let consultasCaja = 0;
  let bloqueosCaja = 0;
  let commits = 0;
  const ordenes: Record<string, unknown>[] = [];
  const pagos: Record<string, unknown>[] = [];
  const producto = {
    id: 'combo-duo', nombre: 'Combo Duo', categoria: 'Combos',
    stock: 92, precio: 21, disponible: true, tiempoPreparacion: 20,
  };
  const tx = {
    $queryRaw: async () => {
      bloqueosCaja++;
      const estado = cajaCierraDuranteCreacion ? 'cerrada' : estadoCaja;
      return estado ? [{ estado }] : [];
    },
    contadorOrdenDiaria: { upsert: async () => ({ ultimoNumero: 1 }) },
    orden: {
      create: async ({ data }: { data: Record<string, unknown> & {
        items: { create: Array<Record<string, unknown>> };
      } }) => {
        ordenes.push(data);
        return {
          ...data, id: 'orden-prueba', printRevision: 1,
          items: data.items.create.map((item) => ({ ...item, producto })),
        };
      },
    },
    producto: { updateMany: async () => ({ count: conflictoStock ? 0 : 1 }) },
    historialOrden: { create: async () => ({}) },
    cobro: { create: async ({ data }: { data: Record<string, unknown> }) => { pagos.push(data); } },
  };
  const prisma = {
    producto: { findMany: async () => [producto] },
    sesionCaja: { findUnique: async () => {
      consultasCaja++;
      return estadoCaja ? { estado: estadoCaja } : null;
    } },
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
      const antes = { ordenes: ordenes.length, pagos: pagos.length };
      try {
        const result = await callback(tx);
        commits++;
        return result;
      } catch (error) {
        ordenes.splice(antes.ordenes);
        pagos.splice(antes.pagos);
        throw error;
      }
    },
  };
  const caja = loadModule('lib/caja.ts', {
    'server-only': {}, '@/lib/db': { prisma },
    '@/lib/fecha-ecuador': fechas, '@/types/caja': cajaTypes,
  });
  const { POST } = loadModule<{ POST: (request: Request) => Promise<Response> }>('app/api/ordenes/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@prisma/client': { Prisma }, '@/lib/db': { prisma }, '@/lib/caja': caja,
    '@/types/caja': cajaTypes, '@/types/orden': ordenTypes, '@/types/cobro': cobroTypes,
    '@/lib/fecha-ecuador': fechas, '@/lib/daily-order-number': dailyNumber,
    '@/lib/ordenes-anulacion': {}, '@/lib/sse': { notificarClientes: () => {} },
    '@/lib/session': {
      getAuthenticatedUser: async () => ({ id: 'usuario-autenticado', nombre: 'Prueba', rol }),
      canCollectPayments: () => ['mesero', 'digital', 'admin'].includes(rol),
    },
    '@/lib/payment-link': { createPaymentLink: () => ({ tokenHash: 'secreto', url: 'http://test.invalid/cobro' }) },
    '@/lib/print-jobs': { PRINT_JOB_TYPES: { ORDER: 'ORDER' }, shouldEnqueuePrintJob: () => false },
    '@/lib/print-config': { isDirectPrintEnabled: () => false },
    '@/lib/printer': { PrinterService: class { constructor() { throw new Error('No debe imprimir'); } } },
  });
  const items = [{ productoId: producto.id, cantidad: 1, precioUnitario: 21, nivelPicante: 'picante_1' }];
  const local = { tipoOrden: 'local', numeroMesa: 1, items, creadorId: 'id-falsificado', creadorRol: 'digital' };
  const domicilio = {
    tipoOrden: 'domicilio', telefonoCliente: '0000000000', costoEnvio: 3,
    metodoPagoPrevisto: 'transferencia', transferenciaConfirmada: true, items,
  };

  async function enviar(body: object) {
    return POST(new Request('http://test.invalid/api/ordenes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
  }

  // La identidad autenticada manda, aunque el payload declare otro creador/rol.
  for (const estado of [null, 'cerrada']) {
    estadoCaja = estado;
    const response = await enviar(local);
    assert.equal(response.status, 409);
    const data = await response.json();
    assert.equal(data.code, 'CAJA_NO_DISPONIBLE');
    assert.match(data.error, estado ? /ya fue cerrada/ : /no ha sido iniciada/);
  }
  assert.equal(commits, 0);
  assert.equal(ordenes.length, 0);

  estadoCaja = 'abierta';
  const abierta = await enviar(local);
  assert.equal(abierta.status, 200);
  assert.equal((await abierta.json()).orden.creadorId, 'usuario-autenticado');
  assert.equal(bloqueosCaja, 1, 'El mesero conserva el candado frente a un cierre concurrente');

  cajaCierraDuranteCreacion = true;
  assert.equal((await enviar(local)).status, 409);
  assert.equal(commits, 1);
  cajaCierraDuranteCreacion = false;

  // Digital puede crear sin caja, incluso registrando la transferencia recibida.
  rol = 'digital';
  estadoCaja = null;
  const lecturasAntes = consultasCaja;
  const bloqueosAntes = bloqueosCaja;
  const transferencia = await enviar(domicilio);
  assert.equal(transferencia.status, 200);
  const data = await transferencia.json();
  assert.equal(data.orden.cobrada, true);
  assert.equal(data.orden.metodoPago, 'transferencia');
  assert.equal(data.orden.montoPagado, Number(data.orden.total));
  assert.equal(pagos.length, 1, 'Se conserva el registro del pago confirmado');
  assert.equal(pagos[0].monto, Number(data.orden.total));
  assert.equal('cobroTokenHash' in data.orden, false);
  assert.equal((await enviar({ tipoOrden: 'para_llevar', nombreCliente: 'Prueba', items })).status, 200);
  assert.equal((await enviar({ ...domicilio, metodoPagoPrevisto: 'efectivo', transferenciaConfirmada: false })).status, 200);
  assert.equal(consultasCaja, lecturasAntes);
  assert.equal(bloqueosCaja, bloqueosAntes);

  conflictoStock = true;
  const commitsAntes = commits;
  const pagosAntes = pagos.length;
  const sinStock = await enviar(domicilio);
  assert.equal(sinStock.status, 409);
  assert.match((await sinStock.json()).error, /stock cambio/);
  assert.equal(commits, commitsAntes);
  assert.equal(pagos.length, pagosAntes);

  console.log('order-creation tests: ok (mesero, digital, caja, transferencia, stock)');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
