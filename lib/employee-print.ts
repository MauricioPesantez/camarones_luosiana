import type { Prisma } from '@prisma/client';
import { calculateAutoPrintUntil, shouldEnqueuePrintJob } from './print-jobs';
import { isDirectPrintEnabled } from './print-config';

type Money = number | string | { toString(): string };
export interface EmployeeReceiptPayload {
  payloadVersion: 1;
  jobType: 'EMPLOYEE_RECEIPT';
  documentId: string;
  lines: string[];
}

function lines(text: string): string[] {
  const clean = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, ' ');
  return clean.match(/.{1,42}/g) ?? [''];
}
const dollars = (value: Money) => `$${Number(value.toString()).toFixed(2)}`;
const separator = '-'.repeat(42);
const signatures = ['', '', 'Firma de quien recibe:', '____________________________', '', 'Firma de quien entrega:', '____________________________', '', separator];

export function employeeReceiptMode(now = new Date()): 'queue' | 'direct' | 'disabled' {
  if (shouldEnqueuePrintJob(now)) return 'queue';
  return isDirectPrintEnabled() ? 'direct' : 'disabled';
}

export function buildEmployeeConsumptionLines(order: {
  id: string; empleadoNombre: string | null; mesero: string; total: Money; recargo: Money | null;
  createdAt: Date | string; items: readonly { cantidad: number; nombreProducto?: string | null; precioUnitario: Money; subtotal: Money; producto?: { nombre: string } }[];
}, copy = false): string[] {
  return [separator, 'CONSUMO DE EMPLEADO', ...(copy ? ['COPIA - NO GENERA OTRO CARGO'] : []), separator,
    ...lines(`Consumo: ${order.id}`), ...lines(`Empleado: ${order.empleadoNombre ?? ''}`),
    ...lines(`Fecha: ${new Date(order.createdAt).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`),
    ...order.items.flatMap(item => lines(`${item.cantidad}x ${item.nombreProducto ?? item.producto?.nombre ?? 'Producto'} a ${dollars(item.precioUnitario)} = ${dollars(item.subtotal)}`)),
    ...lines(`Envases: ${dollars(order.recargo ?? 0)}`), ...lines(`TOTAL A CUENTA: ${dollars(order.total)}`),
    ...lines(`Entrega: ${order.mesero}`), 'Se registra a cuenta del sueldo.', ...signatures];
}

export function buildEmployeeSettlementLines(settlement: {
  id: string; empleadoNombre: string; autorNombre: string; fechaDescuento: Date | string;
  saldoAnterior: Money; montoAplicado: Money; saldoPosterior: Money; snapshot: unknown;
}, copy = false): string[] {
  const snapshot = settlement.snapshot as { saldoArrastrado?: Money; movimientos?: { motivo?: string; monto?: Money; tipo?: string }[] } | null;
  return [separator, 'DESCUENTO DE SUELDO', ...(copy ? ['COPIA - NO REGISTRA OTRO DESCUENTO'] : []), separator,
    ...lines(`Comprobante: ${settlement.id}`), ...lines(`Empleado: ${settlement.empleadoNombre}`),
    ...lines(`Fecha descuento: ${new Date(settlement.fechaDescuento).toLocaleDateString('es-EC', { timeZone: 'America/Guayaquil' })}`),
    ...lines(`Saldo arrastrado: ${dollars(snapshot?.saldoArrastrado ?? 0)}`),
    ...(snapshot?.movimientos ?? []).flatMap(m => lines(`${m.tipo ?? ''}: ${m.motivo ?? ''} ${dollars(m.monto ?? 0)}`)),
    ...lines(`Saldo anterior: ${dollars(settlement.saldoAnterior)}`),
    ...lines(`Descuento aplicado: ${dollars(settlement.montoAplicado)}`),
    ...lines(`Saldo pendiente: ${dollars(settlement.saldoPosterior)}`),
    ...lines(`Registrado por: ${settlement.autorNombre}`), ...signatures];
}

export function buildEmployeeReceiptPayload(documentId: string, receiptLines: string[]): EmployeeReceiptPayload {
  if (!documentId.trim() || !receiptLines.length || receiptLines.some(line => typeof line !== 'string' || line.length > 42 || /[^\x20-\x7e]/.test(line))) throw new Error('Comprobante de empleado invalido');
  return { payloadVersion: 1, jobType: 'EMPLOYEE_RECEIPT', documentId, lines: receiptLines };
}

export async function enqueueEmployeeReceipt(tx: Pick<Prisma.TransactionClient, 'printJob'>, input: {
  documentId: string; ordenId?: string; liquidacionId?: string; lines: string[]; revision?: number; now?: Date;
}) {
  const now = input.now ?? new Date();
  if (employeeReceiptMode(now) !== 'queue') return null;
  const revision = input.revision ?? 0;
  const payload = buildEmployeeReceiptPayload(input.documentId, input.lines);
  const dedupeKey = `${input.documentId}:EMPLOYEE_RECEIPT:${revision}`;
  return tx.printJob.upsert({ where: { dedupeKey }, create: {
    ordenId: input.ordenId, liquidacionId: input.liquidacionId, type: 'EMPLOYEE_RECEIPT',
    dedupeKey, revision, payloadVersion: 1, payload: payload as unknown as Prisma.InputJsonValue,
    availableAt: now, autoPrintUntil: calculateAutoPrintUntil(now),
  }, update: {} });
}

export async function sendEmployeeReceiptAfterCommit(input: { documentId: string; lines: string[] }) {
  const mode = employeeReceiptMode();
  if (mode === 'queue') return { impresionEnCola: true, impresionEnviada: false, impresionError: null };
  if (mode === 'disabled') return { impresionEnCola: false, impresionEnviada: false, impresionError: 'No hay un mecanismo de impresion activo. El registro ya fue guardado.' };
  try {
    const { PrinterService } = await import('./printer');
    const result = await new PrinterService().imprimirEmpleado(buildEmployeeReceiptPayload(input.documentId, input.lines));
    return { impresionEnCola: false, impresionEnviada: result.success, impresionError: result.success ? null : 'El registro fue guardado; no se pudo enviar el comprobante.' };
  } catch {
    return { impresionEnCola: false, impresionEnviada: false, impresionError: 'El registro fue guardado; no se pudo enviar el comprobante.' };
  }
}

/** Historical regularization is recorded now; no physical delivery is attributed retroactively. */
export function buildHistoricalConsumptionLines(order: Parameters<typeof buildEmployeeConsumptionLines>[0], actor: string, regularizedAt: Date): string[] {
  const base = buildEmployeeConsumptionLines(order).filter(line => !line.startsWith('Entrega:'));
  return [...base.slice(0, 2), 'REGULARIZACION ADMINISTRATIVA', ...base.slice(2),
    ...lines(`Registrado originalmente por: ${order.mesero}`),
    ...lines(`Regularizado por: ${actor}`),
    ...lines(`Fecha regularizacion: ${regularizedAt.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`)];
}
