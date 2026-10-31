/* eslint-disable @typescript-eslint/no-require-imports */
/* Local audit: executes real handlers with in-memory dependencies. No DB/network.
 * Run from repository root: node docs/auditoria/2026-10-06/repro-flujos.cjs
 * These probes assert CURRENT defects, not acceptance after fixing them.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = process.cwd();
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', moduleResolution: 'node' });
require(path.join(root, 'node_modules/ts-node/register/transpile-only'));
const { Prisma } = require(path.join(root, 'node_modules/@prisma/client'));
let db, user, authCalls, cuadre;
const originalLoad = Module._load;
Module._load = function(spec, parent, isMain) {
  if (spec === 'server-only') return {};
  if (spec === '@/lib/db') return { prisma: db };
  if (spec === '@/lib/session') return {
    getAuthenticatedUser: async () => { authCalls++; return user; },
    canCollectPayments: u => ['admin', 'mesero', 'digital'].includes(u.rol),
  };
  if (spec === '@/lib/caja') return {
    exigirCajaAbierta: async () => {}, bloquearCajaAbierta: async () => {},
    CajaNoDisponibleError: class extends Error {},
    CAJA_SELECT: {}, serializarCaja: c => c,
  };
  if (spec === '@/lib/cuadre-server') return { obtenerDatosCuadre: async () => cuadre };
  if (spec === '@/lib/sse') return { notificarClientes: () => {} };
  if (spec === '@/lib/storage') return { objectExists: async () => true };
  if (spec.startsWith('@/')) return originalLoad.call(this, path.join(root, spec.slice(2)), parent, isMain);
  return originalLoad.call(this, spec, parent, isMain);
};
const load = f => require(path.join(root, f));
const request = body => new Request('http://audit.invalid/api', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const params = id => ({ params: Promise.resolve({ id }) });
const decimal = n => new Prisma.Decimal(n);
const output = [];
function reset() { db = {}; user = { id: 'admin', nombre: 'Admin', rol: 'admin' }; authCalls = 0; }
function record(name, observed) { output.push({ name, observed }); console.log('REPRODUCED', name, JSON.stringify(observed)); }

(async () => {
  reset(); user = null;
  db.usuario = { findMany: async () => [], create: async ({data}) => ({id:'new-admin',...data}) };
  const createUser = await load('app/api/usuarios/route.ts').POST(request({nombre:'Audit Admin',rol:'admin'}));
  assert.equal(createUser.status,201); assert.equal(authCalls,0);
  record('A01: create admin without session', { status:createUser.status, authCalls });

  reset(); user = null;
  db.usuario = { findUnique: async () => ({id:'admin',nombre:'Admin',rol:'admin',password:'current'}), update: async ({data}) => ({id:'admin',nombre:'Admin',rol:'admin',...data}) };
  const updateUser = await load('app/api/usuarios/[id]/route.ts').PATCH(request({password:null}),params('admin'));
  assert.equal(updateUser.status,200); assert.equal(authCalls,0);
  record('A01: remove admin password without session', { status:updateUser.status, authCalls });

  reset(); user = null;
  db.producto = { findMany: async () => [], create: async ({data}) => ({id:'new-product',...data}) };
  const createProduct = await load('app/api/productos/route.ts').POST(request({nombre:'Audit product',categoria:'Combos',precio:10}));
  assert.equal(createProduct.status,201); assert.equal(authCalls,0);
  record('A01: create product without session', { status:createProduct.status, authCalls });

  reset(); user = null; let stock = 10;
  db.producto = { findUnique: async () => ({id:'p1',nombre:'Product',stock:10}), update: async ({data}) => ({id:'p1',nombre:'Product',stock:stock=data.stock}) };
  const stockRoute = load('app/api/stock/actualizar/route.ts');
  const updates = await Promise.all([stockRoute.POST(request({productoId:'p1',cantidad:5,operacion:'agregar'})),stockRoute.POST(request({productoId:'p1',cantidad:5,operacion:'agregar'}))]);
  assert.equal(stock,15); assert.equal(authCalls,0);
  record('A04: two concurrent +5 stock additions lose one', {statuses:updates.map(r=>r.status),expectedStock:20,observedStock:stock,authCalls});

  reset(); user.rol='cocina';
  let order = {id:'o1',estado:'pendiente_aprobacion_stock',cobrada:false,anulada:false};
  db.orden = { findUnique: async () => ({...order}), update: async ({data}) => (order={...order,...data}) };
  const stateRoute = load('app/api/ordenes/[id]/route.ts');
  const bypass = await stateRoute.PATCH(request({estado:'en_preparacion'}),params('o1'));
  assert.equal(bypass.status,200); assert.equal(order.estado,'en_preparacion');
  record('A03: kitchen bypasses stock approval', {status:bypass.status,estado:order.estado});
  order.estado='cancelada';
  const resurrect = await stateRoute.PATCH(request({estado:'pendiente'}),params('o1'));
  assert.equal(resurrect.status,200);
  record('A03: kitchen reactivates cancelled order', {status:resurrect.status,estado:order.estado});

  reset(); let courtesyStock=1, courtesyItems=[];
  order={id:'o1',estado:'lista',tipoOrden:'para_llevar',anulada:false,total:10,recargo:0,printRevision:0,items:[]};
  const product = {id:'p1',nombre:'Combo',categoria:'Combos',stock:1,disponible:true};
  db.orden={findUnique:async()=>({...order,items:courtesyItems})};
  db.producto={findUnique:async()=>({...product}),update:async({data})=>{courtesyStock-=data.stock.decrement;return {...product,stock:courtesyStock};}};
  db.item={create:async({data})=>{courtesyItems.push(data);return {id:'i'+courtesyItems.length,...data};}};
  db.historialOrden={create:async()=>({})};
  db.$transaction=async fn=>fn(db);
  const courtesyRoute = load('app/api/ordenes/[id]/cortesia/route.ts');
  const gifts=await Promise.all([courtesyRoute.POST(request({productoId:'p1',cantidad:1}),params('o1')),courtesyRoute.POST(request({productoId:'p1',cantidad:1}),params('o1'))]);
  assert.equal(courtesyStock,-1); assert.equal(order.estado,'lista');
  record('A05: concurrent courtesy oversells and never returns ready order to kitchen', {statuses:gifts.map(r=>r.status),stock:courtesyStock,estado:order.estado,revision:order.printRevision,recargo:order.recargo,spice:courtesyItems[0].nivelPicante??null});

  reset(); order={id:'o1',anulada:false,estado:'pendiente',tipoOrden:'local',printRevision:0,total:decimal(10),montoPagado:decimal(0),costoEnvio:null};
  let payments=[];
  db.orden={findUnique:async()=>({...order}),findUniqueOrThrow:async()=>({...order}),updateMany:async({data})=>{order={...order,...data};return {count:1};},update:async({data})=>(order={...order,...data})};
  db.cobro={findMany:async({where})=>where.idempotencyKey?[]:payments,create:async({data})=>{payments.push(data);return data;}};
  db.historialOrden={create:async()=>({})}; db.$transaction=async fn=>fn(db);
  const {collectOrderPayment}=load('lib/order-payment.ts');
  await collectOrderPayment({orderId:'o1',partes:[{metodoPago:'efectivo',monto:10}],expectedRevision:0,idempotencyKey:'audit_payment_0001',origen:'qr',user});
  assert.equal(order.estado,'cobrada');
  record('A02: QR payment changes pending kitchen state to collected', {estado:order.estado,kitchenVisible:['pendiente','en_preparacion'].includes(order.estado)});

  reset(); let annulPaymentsCalls=0;
  order={id:'o1',anulada:false,estado:'en_preparacion',cobrada:false,total:decimal(15),montoPagado:decimal(10),metodoPago:'efectivo'};
  db.orden={findUnique:async()=>({...order}),findUniqueOrThrow:async()=>({...order}),updateMany:async({data})=>{order={...order,...data};return {count:1};}};
  db.cobro={updateMany:async()=>{annulPaymentsCalls++;return {count:1};}};
  db.historialOrden={create:async()=>({})}; db.printJob={updateMany:async()=>({count:0})}; db.$transaction=async fn=>fn(db);
  const annul=await load('app/api/ordenes/[id]/anular/route.ts').PATCH(request({razon:'Audit partial payment'}),params('o1'));
  assert.equal(annul.status,200); assert.equal(annulPaymentsCalls,0);
  record('A06: annulling reopened paid order leaves confirmed payments', {status:annul.status,annulPaymentsCalls});

  const {calcularResumenCuadre}=load('types/cuadre.ts');
  const annulledSummary=calcularResumenCuadre([{anulada:true,cobrada:true,total:10,montoPagado:10,pagos:[{metodoPago:'efectivo',monto:10,estado:'REEMBOLSO_PENDIENTE',enRango:true}]}]);
  assert.equal(annulledSummary.montoReembolsoPendiente,0);
  record('A06: pending refund disappears from annulled order summary', {pendingRefund:annulledSummary.montoReembolsoPendiente,cash:annulledSummary.efectivoEnCaja});
  const rejectedSummary=calcularResumenCuadre([{estado:'cancelada',anulada:false,cobrada:true,total:23,costoEnvio:3,tipoOrden:'domicilio',montoPagado:23,pagos:[{metodoPago:'transferencia',monto:23,estado:'REEMBOLSO_PENDIENTE',enRango:true}]}]);
  assert.equal(rejectedSummary.ventasCobradas,20); assert.equal(rejectedSummary.efectivoEnCaja,-3);
  record('A07: rejected paid order still counts sale and courier payout', {sales:rejectedSummary.ventasCobradas,cash:rejectedSummary.efectivoEnCaja,refund:rejectedSummary.montoReembolsoPendiente});

  reset();
  const caja={id:'cash1',fecha:'2026-10-06',estado:'abierta',montoInicial:0};
  cuadre={caja,ordenes:[{cobrada:false,total:10,montoPagado:0}],retiros:[]};
  db.$queryRaw=async()=>[{id:caja.id}]; db.sesionCaja={update:async({data})=>({...caja,...data})}; db.$transaction=async fn=>fn(db);
  const close=await load('app/api/caja/route.ts').PATCH(request({fecha:caja.fecha,montoCierre:0}));
  assert.equal(close.status,200);
  record('A09: day closes with fully unpaid order', {status:close.status,estado:(await close.json()).caja.estado});

  const base={cobrada:true,tipoOrden:'domicilio',total:23,costoEnvio:3,montoPagado:23,pagos:[{metodoPago:'transferencia',monto:23,enRango:true,estado:'CONFIRMADO'}]};
  const before=calcularResumenCuadre([base]);
  const afterDay1=calcularResumenCuadre([{...base,cobrada:false,total:28,montoPagado:28,pagos:[base.pagos[0],{metodoPago:'efectivo',monto:5,enRango:false,estado:'CONFIRMADO'}]}]);
  const afterDay2=calcularResumenCuadre([{...base,total:28,montoPagado:28,pagos:[{...base.pagos[0],enRango:false},{metodoPago:'efectivo',monto:5,enRango:true,estado:'CONFIRMADO'}]}]);
  assert.equal(before.efectivoEnCaja,-3); assert.equal(afterDay1.efectivoEnCaja,0); assert.equal(afterDay2.efectivoEnCaja,2);
  record('A08: next-day growth moves delivery settlement and changes old report', {day1Before:before.efectivoEnCaja,day1After:afterDay1.efectivoEnCaja,day2Cash:afterDay2.efectivoEnCaja,day2ActualIncrement:5});

  const {validarActoDeCobro}=load('lib/order-payment-validaciones.ts');
  assert.doesNotThrow(()=>validarActoDeCobro({saldo:9.99,partes:[{metodoPago:'efectivo',monto:1.005},{metodoPago:'transferencia',monto:8.99}]}));
  const stored=decimal('1.005').toDecimalPlaces(2).plus(decimal('8.99').toDecimalPlaces(2));
  assert.equal(stored.toNumber(),10);
  record('A17: overprecise amounts break paid-total invariant', {accepted:[1.005,8.99],materializedAmount:9.99,decimalRoundedSum:stored.toNumber()});

  record('A11: queue enabled while direct print default remains enabled', {queue:load('lib/print-jobs.ts').isPrintQueueEnabled('true'),direct:load('lib/print-config.ts').isDirectPrintEnabled(undefined)});

  reset(); user={id:'waiter',nombre:'Waiter',rol:'mesero'};
  process.env.DIRECT_PRINT_ENABLED='false'; process.env.PRINT_QUEUE_ENABLED='false';
  let createdOrders=[], number=0;
  const createProductSnapshot={id:'p1',nombre:'Combo',categoria:'Combos',precio:decimal(11),stock:100,disponible:true,tiempoPreparacion:20};
  db.producto={findMany:async()=>[createProductSnapshot],updateMany:async()=>({count:1})};
  db.contadorOrdenDiaria={upsert:async()=>({ultimoNumero:++number})};
  db.historialOrden={create:async()=>({})};
  db.orden={create:async({data})=>{const result={id:'order'+number,printRevision:0,...data,items:data.items.create.map(i=>({...i,producto:createProductSnapshot}))};createdOrders.push(result);return result;}};
  db.$transaction=async fn=>fn(db);
  const creation=load('app/api/ordenes/route.ts');
  const body={tipoOrden:'local',numeroMesa:1,items:[{productoId:'p1',cantidad:1,nivelPicante:'natural'}],clientRequestId:'same-request-uuid'};
  const first=await creation.POST(request(body)),second=await creation.POST(request(body));
  assert.equal(first.status,200); assert.equal(second.status,200); assert.equal(createdOrders.length,2);
  record('A10: repeat same creation request creates two orders', {statuses:[first.status,second.status],orders:createdOrders.length});
  const invalidType=await creation.POST(request({...body,tipoOrden:'robot',numeroMesa:-4}));
  assert.equal(invalidType.status,200); assert.equal(createdOrders.at(-1).tipoOrden,'robot');
  record('A16: unknown order type is persisted', {status:invalidType.status,tipoOrden:createdOrders.at(-1).tipoOrden});
  const stringShipping=await creation.POST(request({...body,tipoOrden:'domicilio',telefonoCliente:'123',costoEnvio:'3',metodoPagoPrevisto:'efectivo'}));
  assert.equal(stringShipping.status,200); assert.equal(createdOrders.at(-1).total,'12.253');
  record('A16: string delivery cost concatenates into total', {status:stringShipping.status,computedTotal:createdOrders.at(-1).total,expectedTotal:15.25});
  assert.equal(createdOrders[0].tiempoEstimado,0);
  record('A18: Combo preparation time is ignored', {productMinutes:20,orderMinutes:createdOrders[0].tiempoEstimado});
  fs.writeFileSync(path.join(__dirname, 'resultados-reproducciones.json'),JSON.stringify(output,null,2)+'\n');
})().catch(err=>{console.error(err);process.exitCode=1;});
