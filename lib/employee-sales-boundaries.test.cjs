/* eslint-disable @typescript-eslint/no-require-imports -- The tests load CommonJS handlers with injected database and session dependencies. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { transpileModule, ModuleKind, ScriptTarget } = require('typescript');
const { Prisma } = require('@prisma/client');
require('ts-node').register({ compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { PUBLIC_PRODUCT_SELECT } = require('./product-select.ts');
const { calcularResumenCuadre } = require('../types/cuadre.ts');
const { shouldPrintPaymentQr } = require('./payment-link.ts');
const typesOrden = require('../types/orden.ts');
const fechas = require('./fecha-ecuador.ts');
const anulacion = require('./ordenes-anulacion.ts');

let actor = null;
let lastOrderQuery;
let order = { id: 'empleado', tipoOperacion: 'CONSUMO_EMPLEADO', estado: 'pendiente', anulada: false, printRevision: 0, mesero: 'Admin', creadorId: 'admin', items: [] };
const yesterday = new Date(Date.now() - 3 * 86400000);
const records = [
  { id: 'cliente', tipoOperacion: 'VENTA_CLIENTE', estado: 'pendiente', createdAt: new Date(), items: [], creadorId: 'admin' },
  { id: 'empleado', tipoOperacion: 'CONSUMO_EMPLEADO', estado: 'pendiente', createdAt: yesterday, items: [], creadorId: 'admin' },
];
const tx = {
  $queryRaw: async () => [{ id: order.id }],
  orden: {
    findUnique: async () => order,
    findUniqueOrThrow: async () => order,
    updateMany: async ({ where, data }) => {
      if (where.estado !== order.estado || where.printRevision !== order.printRevision) return { count: 0 };
      order = { ...order, estado: data.estado, printRevision: order.printRevision + 1 };
      return { count: 1 };
    },
  },
  historialOrden: { create: async () => ({}) },
};
const prisma = {
  usuario: { findMany: async () => [{ id: 'u', nombre: 'Ana', rol: 'mesero', activo: true, password: 'hash-secreto' }, { id: 'v', nombre: 'Beto', rol: 'cocina', activo: true, password: null }] },
  producto: { findMany: async () => [{ id: 'p', nombre: 'Combo', precio: 10, precioEmpleado: 5, requierePreparacionEmpleado: true }] },
  orden: {
    findUnique: async () => order,
    findMany: async args => {
      lastOrderQuery = args;
      // Interpret the relevant SQL predicates so the route response is checked as well.
      return records.filter(r => (!args.where.tipoOperacion || r.tipoOperacion === args.where.tipoOperacion) && (!args.where.AND || r.createdAt >= args.where.AND[0].OR[0].createdAt.gte || (r.tipoOperacion === 'CONSUMO_EMPLEADO' && args.where.AND[0].OR[1].estado.in.includes(r.estado))));
    },
  },
  $transaction: async callback => callback(tx),
};
const common = {
  'next/server': { NextResponse: { json: Response.json } }, '@prisma/client': { Prisma }, '@/lib/db': { prisma },
  '@/lib/session': { getAuthenticatedUser: async () => actor, canCollectPayments: user => ['admin', 'mesero'].includes(user.rol) },
  '@/lib/product-select': { PUBLIC_PRODUCT_SELECT }, '@/lib/sse': { notificarClientes: () => {} },
  '@/types/orden': typesOrden, '@/lib/fecha-ecuador': fechas, '@/lib/ordenes-anulacion': anulacion,
  '@/lib/print-jobs': { PRINT_JOB_STATUSES: { PENDING: 'PENDING', RETRY: 'RETRY', NEEDS_REVIEW: 'NEEDS_REVIEW' } },
  '@/lib/order-payment': { canUserModifyOrder: user => user.rol === 'admin' },
};
function load(file) {
  const js = transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => common[name] ?? {}, mod, mod.exports);
  return mod.exports;
}
const context = { params: Promise.resolve({ id: 'empleado' }) };
const req = (method, body) => new Request('http://test.local/api', { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });

(async () => {
  const users = load('app/api/usuarios/route.ts');
  const publicUsers = await (await users.GET(req('GET'))).json();
  assert.deepEqual(publicUsers.map(u => u.tienePassword), [true, false]);
  assert(publicUsers.every(u => !('password' in u) && !JSON.stringify(u).includes('hash-secreto')));
  const singleUser = load('app/api/usuarios/[id]/route.ts');
  assert.equal((await singleUser.GET(req('GET'), context)).status, 401);
  actor = { id: 'u', nombre: 'Ana', rol: 'mesero' };
  assert.equal((await singleUser.GET(req('GET'), context)).status, 403);

  const products = load('app/api/productos/route.ts');
  const publicProducts = await (await products.GET(req('GET'))).json();
  assert.equal(publicProducts[0].precio, 10);
  assert.equal('precioEmpleado' in publicProducts[0], false);
  assert.equal('requierePreparacionEmpleado' in publicProducts[0], false);
  assert.equal('precioEmpleado' in PUBLIC_PRODUCT_SELECT, false);
  assert.equal((await products.POST(req('POST', {}))).status, 403);
  actor = null;
  assert.equal((await products.POST(req('POST', {}))).status, 401);
  const productUpdate = load('app/api/productos/[id]/route.ts');
  assert.equal((await productUpdate.PATCH(req('PATCH', {}), context)).status, 401);
  actor = { id: 'u', nombre: 'Ana', rol: 'mesero' };
  assert.equal((await productUpdate.PATCH(req('PATCH', {}), context)).status, 403);

  common['@/lib/order-creation'] = load('lib/order-creation.ts');
  const orders = load('app/api/ordenes/route.ts');
  actor = { id: 'admin', nombre: 'Admin', rol: 'admin' };
  assert.deepEqual((await (await orders.GET(req('GET'))).json()).map(o => o.id), ['cliente']);
  assert.equal(lastOrderQuery.where.tipoOperacion, 'VENTA_CLIENTE');
  assert.deepEqual(lastOrderQuery.include.items.include.producto.select, PUBLIC_PRODUCT_SELECT);
  actor = { id: 'c', nombre: 'Cocina', rol: 'cocina' };
  assert.deepEqual((await (await orders.GET(req('GET'))).json()).map(o => o.id), ['cliente']);
  assert.equal(lastOrderQuery.where.tipoOperacion, 'VENTA_CLIENTE');
  const orderRoute = load('app/api/ordenes/[id]/route.ts');
  assert.equal((await orderRoute.PATCH(req('PATCH', { estado: 'entregada' }), context)).status, 409);
  assert.equal((await orderRoute.PATCH(req('PATCH', { estado: 'lista' }), context)).status, 409);
  assert.equal((await orderRoute.PATCH(req('PATCH', { estado: 'en_preparacion' }), context)).status, 409);
  assert.equal((await orderRoute.PATCH(req('PATCH', { estado: 'lista' }), context)).status, 409);
  assert.equal((await orderRoute.PATCH(req('PATCH', { estado: 'entregada' }), context)).status, 409);

  actor = { id: 'admin', nombre: 'Admin', rol: 'admin' };
  const items = load('app/api/ordenes/[id]/items/route.ts');
  assert.equal((await items.PATCH(req('PATCH', { razon: 'prueba', expectedRevision: 2, items: [{ accion: 'agregar', productoId: 'p', cantidad: 1 }] }), context)).status, 409);
  const cortesias = load('app/api/ordenes/[id]/cortesia/route.ts');
  assert.equal((await cortesias.POST(req('POST', { productoId: 'p', cantidad: 1, razon: 'prueba' }), context)).status, 409);
  const cancel = load('app/api/ordenes/[id]/anular/route.ts');
  assert.equal((await cancel.PATCH(req('PATCH', { razon: 'prueba' }), context)).status, 409);

  const venta = { tipoOperacion: 'VENTA_CLIENTE', total: 10, cobrada: true, montoPagado: 10, metodoPago: 'efectivo' };
  const consumo = { tipoOperacion: 'CONSUMO_EMPLEADO', total: 99, cobrada: true, montoPagado: 99, metodoPago: 'efectivo' };
  assert.deepEqual(calcularResumenCuadre([venta, consumo]), calcularResumenCuadre([venta]));
  // Orden completa a cuenta de empleado: venta sin dinero en caja, fuera de las cifras.
  const aCuenta = { tipoOperacion: 'VENTA_CLIENTE', empleadoId: 'u', total: 12.5, cobrada: true, montoPagado: 12.5, metodoPago: null, pagos: [] };
  assert.deepEqual(calcularResumenCuadre([venta, aCuenta]), calcularResumenCuadre([venta]));
  assert.equal(shouldPrintPaymentQr({ tipoOperacion: 'CONSUMO_EMPLEADO', tipoOrden: 'local', total: 10, cobroUrl: 'https://test.invalid/forged' }), false);
  console.log('employee sales boundary checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
