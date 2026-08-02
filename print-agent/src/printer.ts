import net from 'node:net';

import { loadLogoRaster } from './logo.js';
import type { AgentConfig, PrintJobPayload } from './types.js';

const ESC = 0x1b;
const GS = 0x1d;
const LINE_WIDTH = 42;
const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0x00]);
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
const INVERT_OFF = Buffer.from([GS, 0x42, 0x00]);
const INVERT_ON = Buffer.from([GS, 0x42, 0x01]);
/** Etiquetas cuya etiqueta se imprime en video inverso. */
const EMPHASIZED_LABEL_PATTERN = /^(Tipo|Mesa):/;
/** Etiquetas cuyo valor seleccionado se imprime en video inverso. */
const SELECTED_VALUE_PATTERN = /^(\s*Salsa Louisiana:) (.+)$/;

let logoWarningShown = false;

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

/** Etiqueta a la izquierda y monto pegado al borde derecho del ticket. */
function amountLine(label: string, amount: number): string {
  const value = `${amount < 0 ? '-' : ''}$${Math.abs(amount).toFixed(2)}`;
  const cleanLabel = ascii(label);
  const padding = Math.max(1, LINE_WIDTH - cleanLabel.length - value.length);
  return `${cleanLabel}${' '.repeat(padding)}${value}`;
}

function amendmentReference(order: PrintJobPayload['order'], revision: number): string {
  const visibleOrderNumber = order.dailyNumber ?? order.shortCode;
  const dateParts = order.dailyDate?.match(/^\d{4}-(\d{2})-(\d{2})$/);
  const visibleDate = dateParts ? `${dateParts[2]}-${dateParts[1]}` : null;
  return `ORDEN #${visibleOrderNumber}${visibleDate ? ` ${visibleDate}` : ''} REV ${revision}`;
}

function amendmentQuantityDelta(
  change: NonNullable<PrintJobPayload['changes']>[number],
): number {
  if (
    typeof change.quantityDelta === 'number' &&
    Number.isInteger(change.quantityDelta) &&
    change.quantityDelta !== 0
  ) {
    return change.quantityDelta;
  }
  return (change.quantity ?? 0) - (change.previousQuantity ?? 0);
}

function amendmentAmountDelta(
  change: NonNullable<PrintJobPayload['changes']>[number],
): number | null {
  return typeof change.amountDelta === 'number' && Number.isFinite(change.amountDelta)
    ? change.amountDelta
    : null;
}

function paymentMethodLabel(
  order: PrintJobPayload['order'],
): 'efectivo' | 'transferencia' | null {
  if (order.type !== 'domicilio') return null;
  if (order.paymentMethod !== 'efectivo' && order.paymentMethod !== 'transferencia') {
    return null;
  }
  return order.paymentMethod;
}

/**
 * Bloque de montos al pie del ticket. Debe coincidir con lib/printer.ts.
 *
 * - local: solo el total.
 * - para llevar: productos y recipientes desglosados mas el total a cobrar.
 * - domicilio en efectivo: productos y recipientes. El envio NO entra en el TOTAL:
 *   ese TOTAL es lo que el local le cobra al motorizado. Debajo, en un bloque
 *   propio, va lo que el motorizado le cobra al cliente (TOTAL + envio).
 * - domicilio por transferencia: solo el envio, que es lo unico que se mueve en el local.
 * - domicilio sin modalidad acordada (payloads previos): sin montos, como antes.
 */
function amountLinesForOrder(order: PrintJobPayload['order']): string[] {
  const separator = '-'.repeat(LINE_WIDTH);
  const subtotal = order.total - order.surcharge - order.deliveryCost;

  if (order.type === 'local') {
    return [separator, amountLine('TOTAL:', order.total)];
  }

  if (order.type === 'para_llevar') {
    return [
      separator,
      amountLine('Subtotal productos:', subtotal),
      amountLine('Recipientes:', order.surcharge),
      separator,
      amountLine('TOTAL:', order.total),
    ];
  }

  const paymentMethod = paymentMethodLabel(order);

  if (paymentMethod === 'efectivo') {
    const totalLocal = subtotal + order.surcharge;
    return [
      separator,
      amountLine('Subtotal productos:', subtotal),
      amountLine('Recipientes:', order.surcharge),
      separator,
      amountLine('TOTAL:', totalLocal),
      separator,
      'DELIVERY:',
      amountLine('Envio:', order.deliveryCost),
      amountLine('Cobra al cliente:', totalLocal + order.deliveryCost),
    ];
  }

  if (paymentMethod === 'transferencia') {
    return [separator, amountLine('Envio:', order.deliveryCost)];
  }

  return [];
}

function spiceLevelLabel(
  value: PrintJobPayload['order']['spiceLevel'] | null,
): string | null {
  if (!value) return null;
  if (value === 'leve') return 'LEVE';
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
        centered(amendmentReference(order, payload.revision)),
      ];
  const lines = [
    '='.repeat(LINE_WIDTH),
    ...titleLines,
    '='.repeat(LINE_WIDTH),
    ...(order.type === 'local'
      ? []
      : [`Tipo: ${order.type === 'para_llevar' ? 'PARA LLEVAR' : 'DOMICILIO'}`]),
    ...(paymentMethodLabel(order)
      ? [`Pago: ${paymentMethodLabel(order)!.toUpperCase()}`]
      : []),
    ...(order.type === 'local'
      ? [`Mesa: ${order.tableNumber ?? '-'}`]
      : order.customerName
        ? [`Cliente: ${order.customerName}`]
        : []),
    ...(order.customerPhone ? [`Telefono: ${order.customerPhone}`] : []),
    `${payload.jobType === 'AMENDMENT' ? 'Hora mod.' : 'Hora'}: ${new Date(
      payload.jobType === 'AMENDMENT' ? payload.generatedAt : order.createdAt,
    ).toLocaleString('es-EC')}`,
    '-'.repeat(LINE_WIDTH),
  ];

  if (payload.jobType === 'AMENDMENT') {
    let totalDelta = 0;
    let totalSurchargeDelta = 0;
    let hasAmountDelta = false;
    for (const change of payload.changes ?? []) {
      const quantityDelta = amendmentQuantityDelta(change);
      const amountDelta = amendmentAmountDelta(change);
      const prefix = quantityDelta > 0 ? '+' : '-';
      lines.push(
        `${prefix} ${Math.abs(quantityDelta)}x ${change.productName}${
          change.complimentary ? ' [CORTESIA]' : ''
        }`,
      );
      const changeSpiceLevel = spiceLevelLabel(change.spiceLevel);
      if (changeSpiceLevel) lines.push(`  Salsa Louisiana: ${changeSpiceLevel}`);
      if (amountDelta !== null) {
        hasAmountDelta = true;
        totalDelta += amountDelta;
        lines.push(amountLine('  Cambio:', amountDelta));
      }
      const surchargeDelta = Number(change.surchargeDelta ?? 0);
      if (Number.isFinite(surchargeDelta) && surchargeDelta !== 0) {
        totalSurchargeDelta += surchargeDelta;
        lines.push(amountLine('  Envases:', surchargeDelta));
      }
      if (change.observations) lines.push(`  Obs: ${change.observations}`);
    }

    lines.push(
      '-'.repeat(LINE_WIDTH),
      hasAmountDelta
        ? amountLine('AJUSTE PRODUCTOS:', totalDelta)
        : 'AJUSTE NO DISPONIBLE - REVISAR',
    );
    if (totalSurchargeDelta !== 0) {
      lines.push(amountLine('AJUSTE ENVASES:', totalSurchargeDelta));
      if (hasAmountDelta) {
        lines.push(amountLine('AJUSTE TOTAL:', totalDelta + totalSurchargeDelta));
      }
    }
    if (order.type !== 'local') {
      lines.push('NO REPETIR ENVIO NI RECIPIENTES');
    }
  } else {
    for (const item of order.items) {
      lines.push(`${item.quantity}x ${item.productName}${item.complimentary ? ' [CORTESIA]' : ''}`);
      const itemSpiceLevel = spiceLevelLabel(item.spiceLevel);
      if (itemSpiceLevel) lines.push(`  Salsa Louisiana: ${itemSpiceLevel}`);
      if (item.observations) lines.push(`  Obs: ${item.observations}`);
    }
  }

  // Compatibilidad con payloads históricos sin picante por item.
  const hasItemSpice = order.items.some((item) => spiceLevelLabel(item.spiceLevel));
  const legacySpiceLevel = spiceLevelLabel(order.spiceLevel);
  if (!hasItemSpice && legacySpiceLevel) {
    lines.push('-'.repeat(LINE_WIDTH), `Salsa Louisiana: ${legacySpiceLevel}`);
  }

  if (order.observations) {
    lines.push('-'.repeat(LINE_WIDTH), 'OBSERVACIONES:', order.observations);
  }
  if (payload.reason) lines.push('-'.repeat(LINE_WIDTH), `Motivo: ${payload.reason}`);
  if (payload.requestedBy) lines.push(`Solicita: ${payload.requestedBy}`);
  if (payload.jobType !== 'AMENDMENT') {
    lines.push(...amountLinesForOrder(order));
  }

  lines.push('='.repeat(LINE_WIDTH), '', '', '');
  return lines.map(ascii);
}

function encodeTicketLines(lines: string[]): Buffer {
  const chunks: Buffer[] = [];

  for (const line of lines) {
    const emphasizedLabel = line.match(EMPHASIZED_LABEL_PATTERN);
    const selectedValue = line.match(SELECTED_VALUE_PATTERN);

    if (emphasizedLabel) {
      chunks.push(
        INVERT_ON,
        Buffer.from(emphasizedLabel[0].toUpperCase(), 'ascii'),
        INVERT_OFF,
        Buffer.from(`${line.slice(emphasizedLabel[0].length)}\n`, 'ascii'),
      );
    } else if (selectedValue) {
      // La opcion elegida se resalta en negro con letras blancas.
      chunks.push(
        Buffer.from(`${selectedValue[1]} `, 'ascii'),
        INVERT_ON,
        Buffer.from(` ${selectedValue[2]} `, 'ascii'),
        INVERT_OFF,
        Buffer.from('\n', 'ascii'),
      );
    } else {
      chunks.push(Buffer.from(`${line}\n`, 'ascii'));
    }
  }

  return Buffer.concat(chunks);
}

/** QR nativo ESC/POS (modelo 2, tamano 5, correccion M). */
export function encodeEscPosQr(data: string): Buffer {
  const value = Buffer.from(data, 'utf8');
  if (value.length === 0 || value.length > 1024) {
    throw new PrinterError('URL de cobro no valida', 'INVALID_PAYMENT_URL');
  }
  const storeLength = value.length + 3;
  return Buffer.concat([
    ALIGN_CENTER,
    Buffer.from('ESCANEA PARA COBRAR\n', 'ascii'),
    Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05]),
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),
    Buffer.from([
      GS,
      0x28,
      0x6b,
      storeLength & 0xff,
      (storeLength >> 8) & 0xff,
      0x31,
      0x50,
      0x30,
    ]),
    value,
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
    Buffer.from('\nSe requiere iniciar sesion\n\n', 'ascii'),
    ALIGN_LEFT,
  ]);
}

export function buildEscPosTicket(payload: PrintJobPayload): Buffer {
  const text = encodeTicketLines(linesForPayload(payload));
  const paymentQr =
    payload.jobType !== 'AMENDMENT' && payload.order.paymentUrl
      ? encodeEscPosQr(payload.order.paymentUrl)
      : Buffer.alloc(0);
  let logo: ReturnType<typeof loadLogoRaster> | null = null;

  try {
    logo = loadLogoRaster();
  } catch (error) {
    if (!logoWarningShown) {
      logoWarningShown = true;
      console.warn('No se pudo cargar el logo de impresion:', error);
    }
  }

  return Buffer.concat([
    Buffer.from([ESC, 0x40]),
    ...(logo && logo.length > 0 ? [ALIGN_CENTER, logo, Buffer.from('\n')] : []),
    ALIGN_LEFT,
    text,
    paymentQr,
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
