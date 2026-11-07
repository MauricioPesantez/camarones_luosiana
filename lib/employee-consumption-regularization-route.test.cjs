/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict');
const { readFileSync }=require('node:fs');
const { transpileModule,ModuleKind,ScriptTarget }=require('typescript');
let actor=null, writes=0;
const dependencies={
 'next/server':{NextResponse:{json:Response.json}},
 '@/lib/session':{getAuthenticatedUser:async()=>actor},
 '@/lib/db':{prisma:{}},
 '@/lib/employee-consumption-regularization':{
  analyzeRegularization:async(_db,input)=>({corte:input.corte,candidatos:[],siguienteCursor:null}),
  executeRegularization:async(_db,input)=>{writes++;return {resultados:input.candidatos.map(c=>({ordenId:c.ordenId,estado:'conflicto',cargoAgregado:0})),totalCargosAgregados:0,pendientes:1};},
 },
};
const js=transpileModule(readFileSync('app/api/admin/consumos-empleados/regularizacion/route.ts','utf8'),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};new Function('require','module','exports',js)(n=>{if(!(n in dependencies))throw Error(n);return dependencies[n]},mod,mod.exports);
const req=(method,body)=>new Request('http://local/api',{method,...(body?{body:JSON.stringify(body),headers:{'content-type':'application/json'}}:{})});
(async()=>{
 assert.equal((await mod.exports.GET(req('GET'))).status,401);
 actor={id:'u',nombre:'U',rol:'mesero'};assert.equal((await mod.exports.GET(req('GET'))).status,403);
 actor={id:'a',nombre:'Admin',rol:'admin'};assert.equal((await mod.exports.GET(req('GET'))).status,200);assert.equal(writes,0);
 const base={clientRequestId:'key',motivo:'transición',corte:'2025-01-01T00:00:00.000Z',candidatos:[{ordenId:'o',expectedRevision:0,fingerprint:'a'.repeat(64)}]};
 assert.equal((await mod.exports.POST(req('POST',{...base,motivo:''}))).status,400);
 assert.equal((await mod.exports.POST(req('POST',{...base,candidatos:Array(51).fill(base.candidatos[0])}))).status,400);
 const response=await mod.exports.POST(req('POST',base));assert.equal(response.status,200);assert.equal((await response.json()).resultados[0].estado,'conflicto');assert.equal(writes,1);
 console.log('employee regularization route checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
