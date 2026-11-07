import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { buildEmployeeConsumptionLines, buildEmployeeSettlementLines, buildEmployeeReceiptPayload, employeeReceiptMode, enqueueEmployeeReceipt, sendEmployeeReceiptAfterCommit } from './employee-print';

async function run() {
  const order = { id: 'consumo-1', empleadoNombre: 'José', mesero: 'María', total: '36.75', recargo: '1.25', createdAt: '2026-11-04T15:00:00Z', items: [{ cantidad: 1, nombreProducto: 'Combo histórico', precioUnitario: '35.50', subtotal: '35.50', producto: { nombre: 'Nombre actualizado' } }] };
  const consumption = buildEmployeeConsumptionLines(order).join('\n');
  assert.match(consumption, /CONSUMO DE EMPLEADO/);
  assert.match(consumption, /Empleado: Jose/);
  assert.match(consumption, /Combo historico/);
  assert.doesNotMatch(consumption, /Nombre actualizado/);
  assert.match(consumption, /Envases: \$1.25/);
  assert.match(consumption, /TOTAL A CUENTA: \$36.75/);
  assert.match(consumption, /Firma de quien recibe:/);
  assert.match(consumption, /Firma de quien entrega:/);
  assert.doesNotMatch(consumption, /https?:|ESCANEA PARA COBRAR|QR/);
  assert.match(buildEmployeeConsumptionLines(order, true).join('\n'), /COPIA - NO GENERA OTRO CARGO/);
  const settlement = { id: 'liq-1', empleadoNombre: 'José', autorNombre: 'Admin', fechaDescuento: '2026-11-04T12:00:00Z', saldoAnterior: '36.75', montoAplicado: '20.00', saldoPosterior: '16.75', snapshot: { saldoArrastrado: "10.00", movimientos: [{ tipo: 'APERTURA', motivo: 'Adelanto revisado', monto: '10.00' }, { tipo: 'CONSUMO', motivo: 'Consumo original', monto: '26.75' }] } };
  const receipt = buildEmployeeSettlementLines(settlement, true);
  const text = receipt.join('\n');
  assert.match(text, /COPIA - NO REGISTRA OTRO DESCUENTO/);
  assert.match(text, /Adelanto revisado \$10.00/);
  assert.match(text, /Consumo original \$26.75/);
  assert.match(text, /Saldo arrastrado: \$10.00/);
  assert.match(text, /Saldo anterior: \$36.75/);
  assert.match(text, /Descuento aplicado: \$20.00/);
  assert.match(text, /Saldo pendiente: \$16.75/);
  const payload = buildEmployeeReceiptPayload('liq-1', receipt);
  assert.equal(payload.jobType, 'EMPLOYEE_RECEIPT');
  assert.ok(payload.lines.every(line => line.length <= 42 && /^[\x20-\x7e]*$/.test(line)));
  for (const lines of [[], ['X'.repeat(43)], ['injection\x1b@']]) assert.throws(() => buildEmployeeReceiptPayload('liq-1', lines));
  assert.throws(() => buildEmployeeReceiptPayload(' ', receipt));

  const original = { PRINT_QUEUE_ENABLED: process.env.PRINT_QUEUE_ENABLED, DIRECT_PRINT_ENABLED: process.env.DIRECT_PRINT_ENABLED, PRINT_CUTOVER_AT: process.env.PRINT_CUTOVER_AT };
  try {
    process.env.PRINT_QUEUE_ENABLED = 'true';
    process.env.DIRECT_PRINT_ENABLED = 'true';
    delete process.env.PRINT_CUTOVER_AT;
    assert.equal(employeeReceiptMode(), 'queue', 'Cola activa tiene prioridad y evita impresión directa duplicada');
    const calls: unknown[] = [];
    const tx = { printJob: { upsert: async (args: unknown) => { calls.push(args); return { id: 'job-1' }; } } } as unknown as Pick<Prisma.TransactionClient, 'printJob'>;
    const input = { documentId: 'liq-1', liquidacionId: 'liq-1', lines: receipt, now: new Date('2026-11-04T15:00:00Z') };
    await enqueueEmployeeReceipt(tx, input);
    await enqueueEmployeeReceipt(tx, input);
    assert.deepEqual(calls[0], calls[1], 'Reintentos conservan dedupeKey, snapshot y revisión');
    const first = calls[0] as { where: { dedupeKey: string }; create: { type: string; payload: typeof payload }; update: object };
    assert.equal(first.where.dedupeKey, 'liq-1:EMPLOYEE_RECEIPT:0');
    assert.equal(first.create.type, 'EMPLOYEE_RECEIPT');
    assert.deepEqual(first.create.payload, payload);
    assert.deepEqual(first.update, {}, 'El comprobante en cola ya existente no se reescribe');
    process.env.PRINT_QUEUE_ENABLED = 'false';
    assert.equal(employeeReceiptMode(), 'direct');
    process.env.DIRECT_PRINT_ENABLED = 'false';
    assert.equal(employeeReceiptMode(), 'disabled');
    assert.equal(await enqueueEmployeeReceipt(tx, input), null);
    const disabled = await sendEmployeeReceiptAfterCommit({ documentId: 'liq-1', lines: receipt });
    assert.equal(disabled.impresionEnviada, false);
    assert.match(disabled.impresionError ?? '', /registro ya fue guardado/);
    assert.equal(calls.length, 2, 'Con impresión deshabilitada no se generan trabajos');
  } finally {
    for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  console.log('employee-print tests passed (sin impresora ni base de datos)');
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
