/* eslint-disable @typescript-eslint/no-require-imports -- Transpiled handlers with injected service, printing and session dependencies. */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { transpileModule, ModuleKind, ScriptTarget } = require('typescript');
class AccountError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
let user = { id: 'u', rol: 'mesero' };
let replay = false;
let serviceError = null;
let printCalls = 0;
let notifications = 0;
let serviceCalls = 0;
const order = { id: 'o', estado: 'entregada', items: [], tipoOrden: 'local', printRevision: 0 };
const dependencies = {
  'next/server': { NextResponse: { json: Response.json } }, '@/lib/db': {},
  '@/lib/session': { getAuthenticatedUser: async () => user }, '@/lib/employee-account': { AccountError },
  '@/lib/employee-consumption': {
    createConsumption: async () => { serviceCalls++; if (serviceError) throw serviceError; return { orden: order, printJobQueued: false, replay, receiptLines: ['saved snapshot'] }; },
    changeConsumption: async () => { serviceCalls++; if (serviceError) throw serviceError; return { orden: order, replay, receiptLines: null }; },
  },
  '@/lib/printer': { PrinterService: class { async imprimirComanda() { printCalls++; throw new Error('No automatic printer call allowed'); } } },
  '@/lib/print-config': { isDirectPrintEnabled: () => true },
  '@/lib/employee-print': { sendEmployeeReceiptAfterCommit: async () => { printCalls++; throw new Error('No automatic receipt allowed'); } },
  '@/lib/sse': { notificarClientes: () => { notifications++; } },
};
function load(file) {
  const js = transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; }, mod, mod.exports);
  return mod.exports;
}
const createRoute = load('app/api/consumos-empleados/route.ts');
const actionRoute = load('app/api/consumos-empleados/action.ts');
const request = (json = '{}') => new Request('http://test.local', { method: 'POST', body: json });
(async () => {
  for (const isReplay of [false, true]) {
    replay = isReplay;
    const response = await createRoute.POST(request());
    assert.equal(response.status, isReplay ? 200 : 201);
    const result = await response.json();
    assert.equal(result.printJobQueued, false); assert.equal(result.impresion, null); assert.equal(result.impresionComanda, null); assert.equal(result.replay, isReplay); assert.equal('receiptLines' in result, false);
  }
  for (const action of ['entregar', 'corregir', 'anular']) {
    user = { id: 'admin', rol: 'admin' }; replay = false;
    const result = await (await actionRoute.consumptionAction(request(), 'o', action)).json();
    assert.equal(result.impresion, null);
  }
  assert.equal(printCalls, 0); assert.equal(notifications, 0, 'internal consumption never emits kitchen SSE');
  for (const handler of [r => createRoute.POST(r), r => actionRoute.consumptionAction(r, 'o', 'entregar')]) {
    user = null; assert.equal((await handler(request())).status, 401);
    user = { id: 'k', rol: 'cocina' }; assert.equal((await handler(request())).status, 403);
    user = { id: 'u', rol: 'mesero' };
    for (const status of [400, 403, 409]) { serviceError = new AccountError('Rechazo concreto', status); const response = await handler(request()); assert.equal(response.status, status); assert.equal((await response.json()).error, 'Rechazo concreto'); }
    serviceError = null; assert.equal((await handler(request('{'))).status, 400);
  }
  const calls = serviceCalls;
  assert.equal((await actionRoute.consumptionAction(request(), 'o', 'corregir')).status, 403);
  assert.equal(serviceCalls, calls, 'waiters cannot correct an existing consumption');
  console.log('employee consumption route checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
