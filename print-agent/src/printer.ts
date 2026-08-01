import net from 'node:net';

import type { AgentConfig, PrintJobPayload } from './types.js';

const ESC = 0x1b;
const GS = 0x1d;
const LINE_WIDTH = 42;

export class PrinterError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'PrinterError';
  }
}

function ascii(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '?');
}

function centered(value: string): string {
  const clean = ascii(value).slice(0, LINE_WIDTH);
  return `${' '.repeat(Math.max(0, Math.floor((LINE_WIDTH - clean.length) / 2)))}${clean}`;
}

function spiceLevelLabel(
  value: PrintJobPayload['order']['spiceLevel'],
): string | null {
  if (!value) return null;
  if (value === 'picante_1') return 'PICANTE 1';
  if (value === 'picante_2') return 'PICANTE 2';
  if (value === 'picante_3') return 'PICANTE 3';
  return 'NATURAL';
}

function linesForPayload(payload: PrintJobPayload): string[] {
  if (payload.payloadVersion !== 1 || !payload.order?.id) {
    throw new PrinterError('Payload de impresion no soportado', 'INVALID_PAYLOAD');
  }

  const order = payload.order;
  const visibleOrderNumber = order.dailyNumber ?? order.shortCode;
  const titleLines = payload.jobType === 'ORDER'
    ? [centered(`ORDEN #${visibleOrderNumber}`)]
    : [
        centered(payload.ticketLabel),
        centered(`ORDEN #${visibleOrderNumber}  REV ${payload.revision}`),
      ];
  const lines = [
    '='.repeat(LINE_WIDTH),
    ...titleLines,
    '='.repeat(LINE_WIDTH),
    ...(order.type === 'local'
      ? []
      : [`Tipo: ${order.type === 'para_llevar' ? 'PARA LLEVAR' : 'DOMICILIO'}`]),
    ...(spiceLevelLabel(order.spiceLevel)
      ? [`Picante: ${spiceLevelLabel(order.spiceLevel)}`]
      : []),
    ...(order.type === 'local'
      ? [`Mesa: ${order.tableNumber ?? '-'}`]
      : order.customerName
        ? [`Cliente: ${order.customerName}`]
        : []),
    ...(order.customerPhone ? [`Telefono: ${order.customerPhone}`] : []),
    `Hora: ${new Date(order.createdAt).toLocaleString('es-EC')}`,
    '-'.repeat(LINE_WIDTH),
  ];

  if (payload.jobType === 'AMENDMENT') {
    for (const change of payload.changes ?? []) {
      const prefix = change.action === 'ADD' ? '+' : change.action === 'REMOVE' ? '-' : '~';
      const quantity =
        change.action === 'UPDATE'
          ? `${change.previousQuantity ?? 0}->${change.quantity ?? 0}`
          : String(change.quantity ?? change.previousQuantity ?? 0);
      lines.push(`${prefix} ${quantity}x ${change.productName}`);
      if (change.observations) lines.push(`  Obs: ${change.observations}`);
    }
  } else {
    for (const item of order.items) {
      lines.push(`${item.quantity}x ${item.productName}${item.complimentary ? ' [CORTESIA]' : ''}`);
      if (item.observations) lines.push(`  Obs: ${item.observations}`);
    }
  }

  if (order.observations) {
    lines.push('-'.repeat(LINE_WIDTH), 'OBSERVACIONES:', order.observations);
  }
  if (payload.reason) lines.push('-'.repeat(LINE_WIDTH), `Motivo: ${payload.reason}`);
  if (payload.requestedBy) lines.push(`Solicita: ${payload.requestedBy}`);
  if (order.type === 'local') {
    lines.push('-'.repeat(LINE_WIDTH), `TOTAL: $${order.total.toFixed(2)}`);
  }

  lines.push('='.repeat(LINE_WIDTH), '', '', '');
  return lines.map(ascii);
}

export function buildEscPosTicket(payload: PrintJobPayload): Buffer {
  const text = `${linesForPayload(payload).join('\n')}\n`;
  return Buffer.concat([
    Buffer.from([ESC, 0x40]),
    Buffer.from([ESC, 0x61, 0x00]),
    Buffer.from(text, 'ascii'),
    Buffer.from([GS, 0x56, 0x00]),
  ]);
}

function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code);
  }
  return 'PRINTER_ERROR';
}

export async function sendToPrinter(
  config: AgentConfig,
  payload: PrintJobPayload,
): Promise<void> {
  const ticket = buildEscPosTicket(payload);

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({
      host: config.printerIp,
      port: config.printerPort,
    });
    let settled = false;

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) {
        reject(
          new PrinterError(
            error instanceof Error ? error.message : String(error),
            errorCode(error),
          ),
        );
      } else resolve();
    };

    socket.setTimeout(config.printerTimeoutMs);
    socket.once('timeout', () => finish(new PrinterError('Timeout de impresora', 'ETIMEDOUT')));
    socket.once('error', finish);
    socket.once('connect', () => {
      socket.end(ticket, () => finish());
    });
  });
}
