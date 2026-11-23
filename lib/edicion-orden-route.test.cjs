/* eslint-disable @typescript-eslint/no-require-imports -- El test carga el handler con base de datos y sesion simuladas. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { transpileModule, ModuleKind, ScriptTarget } = require('typescript');
const { Prisma } = require('@prisma/client');
require('ts-node').register({ compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });

const combo = { id: 'combo', nombre: 'Combo', categoria: 'Combos', tiempoPreparacion: 10 };
const papas = { id: 'papas', nombre: 'Papas', categoria: 'Extras', tiempoPreparacion: 5 };
const itemsBase = () => [
  { id: 'i1', productoId: 'combo', producto: combo, cantidad: 2, precioUnitario: 10, subtotal: 20, nivelPicante: 'leve', observaciones: 'sin choclo', esCortesia: false },
  { id: 'i2', productoId: 'papas', producto: papas, cantidad: 1, precioUnitario: 0, subtotal: 0, nivelPicante: null, observaciones: null, esCortesia: true },
];

let actor = { id: 'm', nombre: 'Ana', rol: 'mesero' };
let order;
let items;
let escrituras;
let comanda;
let historial;

function reiniciar(extra = {}) {
  items = itemsBase();
  escrituras = [];
  comanda = null;
  historial = [];
  order = { id: 'o1', tipoOperacion: 'VENTA_CLIENTE', empleadoId: null, estado: 'en_preparacion', tipoOrden: 'local', anulada: false, printRevision: 3, montoPagado: 0, total: 20, descuento: 0, recargo: null, costoEnvio: null, mesero: 'Ana', creadorId: 'm', ...extra };
}

const tx = {
  orden: {
    findUnique: async () => ({ ...order, items: items.map(i => ({ ...i })) }),
    updateMany: async ({ data }) => { order = { ...order, ...data }; escrituras.push('orden'); return { count: 1 }; },
    findUniqueOrThrow: async () => ({ ...order, items }),
  },
  item: {
    update: async ({ where, data }) => { escrituras.push('item'); Object.assign(items.find(i => i.id === where.id), data); },
    delete: async () => { escrituras.push('item'); },
    create: async ({ data }) => { escrituras.push('item'); const nuevo = { id: 'n', esCortesia: false, producto: papas, ...data }; items.push(nuevo); return nuevo; },
    findMany: async () => items,
  },
  producto: {
    findUnique: async () => ({ ...papas, precio: 2.5, disponible: true }),
    update: async () => { escrituras.push('stock'); },
    updateMany: async () => { escrituras.push('stock'); return { count: 1 }; },
  },
  historialOrden: { createMany: async ({ data }) => { historial = data; } },
};

const dependencias = {
  'next/server': { NextResponse: { json: Response.json } },
  '@prisma/client': { Prisma },
  '@/lib/db': { prisma: { $transaction: async callback => callback(tx) } },
  '@/lib/session': { getAuthenticatedUser: async () => actor, canCollectPayments: () => true },
  '@/lib/product-select': { PUBLIC_PRODUCT_SELECT: {} },
  '@/lib/sse': { notificarClientes: () => {} },
  '@/lib/order-payment': { canUserModifyOrder: () => true },
  '@/lib/whatsapp-mensajes': { textoActualizacionItems: () => '', textoActualizacionMoto: () => '' },
  '@/lib/whatsapp-salidas': { refrescarRecordatorio: async () => {}, registrarCambioWhatsapp: async () => {} },
  '@/lib/print-jobs': { PRINT_JOB_TYPES: { AMENDMENT: 'AMENDMENT' }, shouldEnqueuePrintJob: () => true, enqueueOrderPrintJob: async (_tx, _orden, opciones) => { comanda = opciones; } },
  '@/types/orden': require('../types/orden.ts'),
  '@/lib/edicion-orden': require('./edicion-orden.ts'),
};
const js = transpileModule(readFileSync('app/api/ordenes/[id]/items/route.ts', 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', js)(nombre => {
  if (!(nombre in dependencias)) throw new Error(`Dependencia sin simular: ${nombre}`);
  return dependencias[nombre];
}, mod, mod.exports);

const editar = async cambios => {
  const res = await mod.exports.PATCH(
    new Request('http://test.local/api', { method: 'PATCH', body: JSON.stringify({ items: cambios, razon: 'prueba', expectedRevision: 3 }) }),
    { params: Promise.resolve({ id: 'o1' }) },
  );
  return { status: res.status, cuerpo: await res.json() };
};

(async () => {
  // Un mesero no puede ampliar ni quitar una cortesia, y no se escribe nada.
  reiniciar();
  for (const cambio of [{ accion: 'modificar', itemId: 'i2', cantidad: 5 }, { accion: 'eliminar', itemId: 'i2' }]) {
    const { status, cuerpo } = await editar([cambio]);
    assert.equal(status, 409);
    assert.match(cuerpo.error, /cortesía/);
  }
  assert.deepEqual(escrituras, []);

  // El admin si.
  actor = { id: 'a', nombre: 'Jefe', rol: 'admin' };
  assert.equal((await editar([{ accion: 'modificar', itemId: 'i2', cantidad: 2 }])).status, 200);
  actor = { id: 'm', nombre: 'Ana', rol: 'mesero' };

  // Cambiar el picante no mueve stock ni dinero, conserva la nota y sale en la comanda.
  reiniciar();
  const picante = await editar([{ accion: 'modificar', itemId: 'i1', cantidad: 2, nivelPicante: 'natural' }]);
  assert.equal(picante.status, 200);
  assert.equal(picante.cuerpo.diferencia, 0);
  assert.equal(items[0].nivelPicante, 'natural');
  assert.ok(!escrituras.includes('stock'));
  assert.equal(order.estado, 'en_preparacion');
  assert.deepEqual(
    comanda.changes.map(c => [c.action, c.quantityDelta, c.spiceLevel, c.amountDelta, c.observations]),
    [['REMOVE', -2, 'leve', -20, 'sin choclo'], ['ADD', 2, 'natural', 20, 'sin choclo']],
  );
  assert.equal(historial[0].descripcion, 'Modificado: Combo (picante Leve → Natural)');

  // Con la orden lista o con un pago, el picante no cambia.
  for (const extra of [{ estado: 'lista' }, { montoPagado: 5 }]) {
    reiniciar(extra);
    assert.equal((await editar([{ accion: 'modificar', itemId: 'i1', cantidad: 2, nivelPicante: 'natural' }])).status, 409);
    assert.deepEqual(escrituras, []);
  }

  // Un producto nuevo lleva su nota; una nota que no es texto corto se rechaza.
  reiniciar();
  assert.equal((await editar([{ accion: 'agregar', productoId: 'papas', cantidad: 1, observaciones: 'sin sal' }])).status, 200);
  assert.equal(items.at(-1).observaciones, 'sin sal');
  for (const observaciones of ['x'.repeat(201), { a: 1 }]) {
    reiniciar();
    assert.equal((await editar([{ accion: 'agregar', productoId: 'papas', cantidad: 1, observaciones }])).status, 400);
  }

  console.log('edicion-orden route tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
