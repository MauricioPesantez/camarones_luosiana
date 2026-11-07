/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
require('ts-node').register({ compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { Prisma } = require('@prisma/client');
const { analyzeRegularizationOrder } = require('./employee-consumption-regularization.ts');
const d = n => new Prisma.Decimal(n);
const order = () => ({ id:'o', tipoOperacion:'CONSUMO_EMPLEADO', empleadoId:'u', empleadoNombre:'Ana', estado:'pendiente', anulada:false, printRevision:0, createdAt:new Date('2025-01-01'), mesero:'Admin', total:d(10), recargo:d(0), items:[{id:'i', nombreProducto:'Pollo', cantidad:2, precioUnitario:d(5), subtotal:d(10)}], historial:[{tipoAccion:'consumo_creado', datosDespues:{items:[{itemId:'i',envase:false}]}}], movimientosCuenta:[], printJobs:[] });
for (const estado of ['pendiente','en_preparacion','lista']) { const r=analyzeRegularizationOrder({...order(),estado}); assert.equal(r.cargoFaltante,10); assert.deepEqual(r.incidencias,[]); }
assert.equal(analyzeRegularizationOrder({...order(),anulada:true}).excluido,true);
assert.equal(analyzeRegularizationOrder({...order(),estado:'entregada'}).excluido,true);
assert(analyzeRegularizationOrder({...order(),empleadoId:null}).incidencias.length);
assert(analyzeRegularizationOrder({...order(),items:[{...order().items[0],nombreProducto:null}]}).incidencias.length);
assert(analyzeRegularizationOrder({...order(),total:d(11)}).incidencias.length);
assert(analyzeRegularizationOrder({...order(),total:d(11),recargo:d(1)}).incidencias.length);
const badPrice=order(); badPrice.items[0].precioUnitario=d(-1); badPrice.items[0].subtotal=d(-2); badPrice.total=d(-2); assert(analyzeRegularizationOrder(badPrice).incidencias.length);
const existing={id:'m',empleadoId:'u',tipo:'CONSUMO',monto:d(10),origenClave:'consumo:o',movimientoOrigenId:null};
assert.equal(analyzeRegularizationOrder({...order(),movimientosCuenta:[existing]}).cargoFaltante,0);
assert(analyzeRegularizationOrder({...order(),movimientosCuenta:[{...existing,origenClave:'otro'}]}).incidencias.length);
const malformed=order(); malformed.historial[0].datosDespues.items=[null]; assert(analyzeRegularizationOrder(malformed).incidencias.length);
const malformedCorrection=order(); malformedCorrection.historial.push({tipoAccion:'consumo_corregido',datosDespues:{items:[null]}}); assert(analyzeRegularizationOrder(malformedCorrection).incidencias.length);
const corrected = order(); corrected.historial.push({tipoAccion:'consumo_corregido',datosDespues:{requestKey:'fix',items:[{itemId:'i',cantidad:2,devolverEnvase:false}]}});
assert.equal(analyzeRegularizationOrder(corrected).cargoFaltante,0);
assert.deepEqual(analyzeRegularizationOrder(corrected).incidencias,[]);
const transferred=order(); transferred.empleadoId='v'; transferred.empleadoNombre='Vera'; transferred.historial[0].datosDespues.empleadoId='u';
transferred.historial.push({tipoAccion:'consumo_corregido',datosDespues:{requestKey:'move',items:[],empleadoAnteriorId:'u',empleadoNuevoId:'v'}});
transferred.movimientosCuenta=[existing,{id:'out',empleadoId:'u',tipo:'REVERSO_CONSUMO',monto:d(-10),origenClave:'move:traslado-salida',movimientoOrigenId:'m'},{id:'in',empleadoId:'v',tipo:'CONSUMO',monto:d(10),origenClave:'move:traslado-entrada',movimientoOrigenId:null}];
assert.deepEqual(analyzeRegularizationOrder(transferred).incidencias,[]);
transferred.movimientosCuenta[2].empleadoId='x'; assert(analyzeRegularizationOrder(transferred).incidencias.length);
transferred.movimientosCuenta[2].empleadoId='v'; transferred.movimientosCuenta[1].monto=d(-100); transferred.movimientosCuenta[2].monto=d(100); assert(analyzeRegularizationOrder(transferred).incidencias.length);
console.log('employee consumption regularization analysis checks passed');

(async () => {
  const { executeRegularization } = require('./employee-consumption-regularization.ts');
  let failHistory = false;
  let state = { order: order(), user: {id:'u',nombre:'Ana',activo:false,cuentaActivadaAt:null,cuentaRevision:0}, movements:[], histories:[], jobs:[{id:'j',type:'ORDER',status:'PENDING'},{id:'r',type:'EMPLOYEE_RECEIPT',status:'PENDING'}] };
  state.order.historial[0].datosDespues.empleadoId='u';
  state.order.printJobs=state.jobs;
  const db = {
    orden: {count:async()=> state.order.estado==='entregada'?0:1},
    $transaction: async fn => {
      const copy={order:{...state.order, historial:[...state.order.historial], movimientosCuenta:[...state.order.movimientosCuenta], printJobs:state.jobs.map(j=>({...j}))},user:{...state.user},movements:[...state.movements],histories:[...state.histories],jobs:state.jobs.map(j=>({...j}))};
      const tx={
        $executeRaw:async()=>0,
        $queryRaw:async(_q,id)=> id===copy.order.id || id===copy.user.id ? [{id}] : [],
        orden:{findUniqueOrThrow:async()=>({...copy.order,printJobs:copy.jobs}),update:async({data})=>{copy.order.estado=data.estado;copy.order.printRevision++;}},
        usuario:{findUniqueOrThrow:async()=>copy.user,update:async({data})=>Object.assign(copy.user,data)},
        movimientoCuentaEmpleado:{aggregate:async()=>({_sum:{monto:copy.movements.reduce((sum,m)=>sum.add(m.monto),d(0))}}),create:async({data})=>{const row={...data,id:'m1'};copy.movements.push(row);copy.order.movimientosCuenta.push(row);return row;}},
        printJob:{updateMany:async({where,data})=>{for(const j of copy.jobs)if(where.type.in.includes(j.type)&&where.status.in.includes(j.status))Object.assign(j,data);},findFirst:async({where})=>copy.jobs.find(j=>where.type.in.includes(j.type)&&j.status===where.status)||null},
        historialOrden:{findFirst:async({where})=>copy.histories.find(h=>h.datosDespues.requestKey===where.datosDespues.path && false)||copy.histories.find(h=>h.datosDespues.requestKey===where.datosDespues.equals)||null,create:async({data})=>{if(failHistory) throw Error('fallo simulado');copy.histories.push(data);copy.order.historial.push(data);}},
      };
      const result=await fn(tx); state={...copy,order:{...copy.order,printJobs:copy.jobs}};return result;
    },
  };
  const actor={id:'admin',nombre:'Admin',rol:'admin'};
  const before=analyzeRegularizationOrder(state.order);
  const input={clientRequestId:'batch',motivo:'Regularización',corte:'2026-01-01T00:00:00.000Z',candidatos:[{ordenId:'o',expectedRevision:before.expectedRevision,fingerprint:before.fingerprint}]};
  let response=await executeRegularization(db,{...input,clientRequestId:'stale',candidatos:[{...input.candidatos[0],fingerprint:'0'.repeat(64)}]},actor); assert.equal(response.resultados[0].estado,'conflicto'); assert.equal(state.movements.length,0);
  failHistory=true; const originalError=console.error; console.error=()=>{}; response=await executeRegularization(db,{...input,clientRequestId:'failure'},actor); console.error=originalError; failHistory=false; assert.equal(response.resultados[0].estado,'conflicto'); assert.equal(state.movements.length,0); assert.equal(state.user.cuentaRevision,0); assert.equal(state.order.estado,'pendiente'); assert.equal(state.jobs[0].status,'PENDING');
  response=await executeRegularization(db,input,actor);
  assert.equal(response.resultados[0].estado,'regularizado');assert.equal(response.totalCargosAgregados,10);assert.equal(state.movements.length,1);assert.equal(state.user.cuentaRevision,1);assert.equal(state.user.activo,false);assert.equal(state.user.cuentaActivadaAt,null);assert.equal(state.jobs[0].status,'DISCARDED');assert.equal(state.jobs[1].status,'PENDING');
  assert.equal(state.histories[0].datosDespues.cargoCanonicoId,'m1');
  assert.equal(state.histories[0].datosDespues.cargoOrigenClave,'consumo:o');
  response=await executeRegularization(db,input,actor);assert.equal(response.resultados[0].estado,'ya_regularizado');assert.equal(state.movements.length,1);
  await assert.rejects(()=>executeRegularization(db,{...input,motivo:'Otro'},actor),/CLAVE_REUTILIZADA/);
  const zero=order(); zero.historial.push({tipoAccion:'consumo_corregido',datosDespues:{requestKey:'zero',items:[{itemId:'i',cantidad:2,devolverEnvase:false}]}});
  state={order:zero,user:{id:'u',nombre:'Ana',activo:false,cuentaActivadaAt:null,cuentaRevision:0},movements:[],histories:[],jobs:[]};
  const zeroAnalysis=analyzeRegularizationOrder(zero);
  response=await executeRegularization(db,{clientRequestId:'zero',motivo:'Regularización',corte:input.corte,candidatos:[{ordenId:'o',expectedRevision:zeroAnalysis.expectedRevision,fingerprint:zeroAnalysis.fingerprint}]},actor);
  assert.equal(response.resultados[0].estado,'regularizado');assert.equal(response.totalCargosAgregados,0);assert.equal(state.movements.length,0);assert.equal(state.user.cuentaRevision,0);
  console.log('employee regularization transaction checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
