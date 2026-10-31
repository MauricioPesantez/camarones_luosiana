import type { Prisma } from '@prisma/client';
import { CATEGORIA_ADELANTO, obtenerEtiquetaCategoriaRetiro } from '../types/retiro';
import {
  calculateAutoPrintUntil,
  DEFAULT_MAX_PRINT_ATTEMPTS,
  shouldEnqueuePrintJob,
} from './print-jobs';
import { isDirectPrintEnabled } from './print-config';

export interface WithdrawalReceiptSource {
  id: string;
  monto: number | string | { toString(): string };
  categoria: string;
  motivo: string;
  usuarioNombre: string;
  beneficiarioNombre: string | null;
  estado: string;
  createdAt: Date | string;
}

export interface WithdrawalPrintPayload {
  payloadVersion: 1;
  jobType: 'CASH_WITHDRAWAL';
  withdrawalId: string;
  lines: string[];
}

function textLines(value: string): string[] {
  const clean = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(/[^\x20-\x7E\n]/g, '?');
  const lines: string[] = [];
  for (const paragraph of clean.split('\n')) {
    let remaining = paragraph.trim();
    while (remaining) {
      const space = remaining.length > 42 ? remaining.lastIndexOf(' ', 42) : remaining.length;
      const end = space > 0 ? space : 42;
      lines.push(remaining.slice(0, end));
      remaining = remaining.slice(end).trimStart();
    }
  }
  return lines;
}

export function getWithdrawalPrintMode(createdAt: Date): 'queue' | 'direct' | 'disabled' {
  if (shouldEnqueuePrintJob(createdAt)) return 'queue';
  return isDirectPrintEnabled() ? 'direct' : 'disabled';
}

/** Snapshot imprimible: no depende de cambios posteriores de nombres o categorias. */
export function buildWithdrawalPrintPayload(
  retiro: WithdrawalReceiptSource,
  copy = false,
): WithdrawalPrintPayload {
  const amount = Number(retiro.monto.toString());
  const createdAt = new Date(retiro.createdAt);
  const advance = retiro.categoria === CATEGORIA_ADELANTO;
  if (retiro.estado !== 'registrado' || !retiro.id.trim() || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(createdAt.getTime())) {
    throw new Error('Retiro no valido para imprimir');
  }
  if (advance && !retiro.beneficiarioNombre?.trim()) {
    throw new Error('El adelanto necesita el nombre de quien recibe');
  }
  const separator = '-'.repeat(42);
  const amountText = `$${amount.toFixed(2)}`;
  const lines = [
    separator,
    advance ? 'ADELANTO A EMPLEADO' : 'RETIRO DE CAJA',
    ...(copy ? ['COPIA DE COMPROBANTE', 'NO REGISTRA OTRA SALIDA DE DINERO'] : []),
    separator,
    ...textLines(`Retiro: ${retiro.id}`),
    ...textLines(`Fecha: ${createdAt.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}`),
    ...textLines(`Categoria: ${obtenerEtiquetaCategoriaRetiro(retiro.categoria)}`),
    ...textLines(`Motivo: ${retiro.motivo}`),
    separator,
    `MONTO RETIRADO:${' '.repeat(Math.max(1, 42 - 'MONTO RETIRADO:'.length - amountText.length))}${amountText}`,
    separator,
    ...textLines(`${advance ? 'Entrega' : 'Retirado por'}: ${retiro.usuarioNombre}`),
  ];
  if (advance) {
    lines.push(
      ...textLines(`Recibe: ${retiro.beneficiarioNombre}`),
      '', '', '', 'Firma de quien recibe:', '____________________________',
      '', '', '', 'Firma de quien entrega:', '____________________________',
    );
  }
  lines.push('', separator, '', '', '');
  return { payloadVersion: 1, jobType: 'CASH_WITHDRAWAL', withdrawalId: retiro.id, lines };
}

export async function enqueueWithdrawalPrintJob(
  tx: Pick<Prisma.TransactionClient, 'printJob'>,
  retiro: WithdrawalReceiptSource,
  revision = 0,
  now = new Date(),
) {
  const payload = buildWithdrawalPrintPayload(retiro, revision > 0);
  return tx.printJob.upsert({
    where: { dedupeKey: `${retiro.id}:CASH_WITHDRAWAL:${revision}` },
    create: {
      retiroId: retiro.id,
      type: 'CASH_WITHDRAWAL',
      status: 'PENDING',
      dedupeKey: `${retiro.id}:CASH_WITHDRAWAL:${revision}`,
      revision,
      payloadVersion: 1,
      payload: payload as unknown as Prisma.InputJsonValue,
      maxAttempts: DEFAULT_MAX_PRINT_ATTEMPTS,
      availableAt: now,
      autoPrintUntil: calculateAutoPrintUntil(now),
    },
    update: {},
  });
}
