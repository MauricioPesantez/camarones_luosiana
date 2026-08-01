import type { Prisma } from '@prisma/client';
import type { NivelPicante } from '@/types/orden';

export const PRINT_PAYLOAD_VERSION = 1 as const;
export const DEFAULT_AUTO_PRINT_WINDOW_MINUTES = 5;
export const DEFAULT_MAX_PRINT_ATTEMPTS = 10;

export const PRINT_JOB_TYPES = {
  ORDER: 'ORDER',
  AMENDMENT: 'AMENDMENT',
  REPRINT: 'REPRINT',
} as const;

export const PRINT_JOB_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  RETRY: 'RETRY',
  SUCCEEDED: 'SUCCEEDED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  DISCARDED: 'DISCARDED',
  FAILED: 'FAILED',
} as const;

export type PrintJobTypeValue =
  (typeof PRINT_JOB_TYPES)[keyof typeof PRINT_JOB_TYPES];

export type PrintJobStatusValue =
  (typeof PRINT_JOB_STATUSES)[keyof typeof PRINT_JOB_STATUSES];

const PRINT_JOB_TRANSITIONS: Record<
  PrintJobStatusValue,
  readonly PrintJobStatusValue[]
> = {
  PENDING: ['PROCESSING', 'NEEDS_REVIEW', 'DISCARDED'],
  PROCESSING: ['SUCCEEDED', 'RETRY', 'NEEDS_REVIEW', 'FAILED'],
  RETRY: ['PROCESSING', 'NEEDS_REVIEW', 'DISCARDED', 'FAILED'],
  SUCCEEDED: [],
  NEEDS_REVIEW: ['PENDING', 'DISCARDED'],
  DISCARDED: [],
  FAILED: ['PENDING', 'DISCARDED'],
};

type NumericValue =
  | number
  | string
  | { toNumber(): number }
  | { toString(): string };

export interface PrintItemSource {
  id?: string;
  cantidad: number;
  observaciones?: string | null;
  precioUnitario?: NumericValue;
  subtotal?: NumericValue;
  esCortesia?: boolean;
  producto: {
    id?: string;
    nombre: string;
  };
}

export interface PrintOrderSource {
  id: string;
  numeroDiario?: number | null;
  tipoOrden?: string | null;
  nivelPicante?: string | null;
  numeroMesa?: number | null;
  nombreCliente?: string | null;
  telefonoCliente?: string | null;
  mesero: string;
  observaciones?: string | null;
  recargo?: NumericValue | null;
  costoEnvio?: NumericValue | null;
  total: NumericValue;
  createdAt: string | Date;
  items: readonly PrintItemSource[];
}

export type AmendmentAction = 'ADD' | 'UPDATE' | 'REMOVE';

export interface AmendmentChangeSource {
  action: AmendmentAction;
  itemId?: string;
  productId?: string;
  productName: string;
  previousQuantity?: number;
  quantity?: number;
  observations?: string | null;
}

export interface PrintOrderSnapshot {
  id: string;
  shortCode: string;
  dailyNumber: number | null;
  type: 'local' | 'para_llevar' | 'domicilio';
  spiceLevel: NivelPicante;
  tableNumber: number | null;
  customerName: string | null;
  customerPhone: string | null;
  waiterName: string;
  observations: string | null;
  surcharge: number;
  deliveryCost: number;
  total: number;
  createdAt: string;
  items: Array<{
    id: string | null;
    productId: string | null;
    productName: string;
    quantity: number;
    observations: string | null;
    unitPrice: number | null;
    subtotal: number | null;
    complimentary: boolean;
  }>;
}

interface PrintPayloadBase {
  payloadVersion: typeof PRINT_PAYLOAD_VERSION;
  jobType: PrintJobTypeValue;
  revision: number;
  ticketLabel: 'ORDEN' | 'MODIFICACION' | 'REIMPRESION';
  generatedAt: string;
  order: PrintOrderSnapshot;
}

export interface OrderPrintPayload extends PrintPayloadBase {
  jobType: 'ORDER';
  ticketLabel: 'ORDEN';
}

export interface AmendmentPrintPayload extends PrintPayloadBase {
  jobType: 'AMENDMENT';
  ticketLabel: 'MODIFICACION';
  changes: Array<{
    action: AmendmentAction;
    itemId: string | null;
    productId: string | null;
    productName: string;
    previousQuantity: number | null;
    quantity: number | null;
    observations: string | null;
  }>;
  reason: string;
  requestedBy: string;
}

export interface ReprintPrintPayload extends PrintPayloadBase {
  jobType: 'REPRINT';
  ticketLabel: 'REIMPRESION';
  reason: string;
  requestedBy: string;
}

export type PrintJobPayload =
  | OrderPrintPayload
  | AmendmentPrintPayload
  | ReprintPrintPayload;

interface PayloadOptions {
  revision?: number;
  generatedAt?: Date;
}

export interface AmendmentPayloadOptions extends PayloadOptions {
  reason: string;
  requestedBy: string;
}

export interface ReprintPayloadOptions extends PayloadOptions {
  reason: string;
  requestedBy: string;
}

export interface EnqueuePrintJobOptions {
  type: PrintJobTypeValue;
  revision: number;
  changes?: readonly AmendmentChangeSource[];
  reason?: string;
  requestedBy?: string;
  now?: Date;
  autoPrintWindowMinutes?: number | null;
  maxAttempts?: number;
}

export interface ShouldEnqueuePrintJobOptions {
  enabled?: string;
  cutoverAt?: string;
}

export type PrintJobTransaction = Pick<Prisma.TransactionClient, 'printJob'>;

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} debe ser un entero mayor o igual a cero`);
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} debe ser un entero mayor a cero`);
  }
}

function assertOptionalNonNegativeInteger(
  value: number | undefined,
  field: string,
): void {
  if (value !== undefined) assertNonNegativeInteger(value, field);
}

function toNumber(value: NumericValue | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;

  const converted =
    typeof value === 'object' && 'toNumber' in value
      ? value.toNumber()
      : Number(value.toString());

  if (!Number.isFinite(converted)) {
    throw new Error('El payload de impresion contiene un valor numerico invalido');
  }

  return converted;
}

function toIsoString(value: string | Date, field: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} contiene una fecha invalida`);
  }
  return date.toISOString();
}

function normalizeOrderType(
  value: string | null | undefined,
): PrintOrderSnapshot['type'] {
  if (value === 'para_llevar' || value === 'domicilio') return value;
  return 'local';
}

function normalizeSpiceLevel(
  value: string | null | undefined,
): NivelPicante {
  if (
    value === 'picante_1' ||
    value === 'picante_2' ||
    value === 'picante_3'
  ) {
    return value;
  }
  return 'natural';
}

function normalizeRequiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} es requerido`);
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildOrderSnapshot(order: PrintOrderSource): PrintOrderSnapshot {
  const id = normalizeRequiredText(order.id, 'orden.id');
  const dailyNumber = order.numeroDiario ?? null;
  if (dailyNumber !== null) {
    assertPositiveInteger(dailyNumber, 'orden.numeroDiario');
  }
  if (order.items.length === 0) {
    throw new Error('La orden debe incluir al menos un item imprimible');
  }

  return {
    id,
    shortCode: id.slice(-6),
    dailyNumber,
    type: normalizeOrderType(order.tipoOrden),
    spiceLevel: normalizeSpiceLevel(order.nivelPicante),
    tableNumber: order.numeroMesa ?? null,
    customerName: normalizeOptionalText(order.nombreCliente),
    customerPhone: normalizeOptionalText(order.telefonoCliente),
    waiterName: normalizeRequiredText(order.mesero, 'orden.mesero'),
    observations: normalizeOptionalText(order.observaciones),
    surcharge: toNumber(order.recargo),
    deliveryCost: toNumber(order.costoEnvio),
    total: toNumber(order.total),
    createdAt: toIsoString(order.createdAt, 'orden.createdAt'),
    items: order.items.map((item) => {
      assertPositiveInteger(item.cantidad, 'item.cantidad');

      return {
        id: normalizeOptionalText(item.id),
        productId: normalizeOptionalText(item.producto.id),
        productName: normalizeRequiredText(
          item.producto.nombre,
          'item.producto.nombre',
        ),
        quantity: item.cantidad,
        observations: normalizeOptionalText(item.observaciones),
        unitPrice:
          item.precioUnitario === undefined
            ? null
            : toNumber(item.precioUnitario),
        subtotal:
          item.subtotal === undefined ? null : toNumber(item.subtotal),
        complimentary: item.esCortesia === true,
      };
    }),
  };
}

export function buildOrderPrintPayload(
  order: PrintOrderSource,
  options: PayloadOptions = {},
): OrderPrintPayload {
  const revision = options.revision ?? 0;
  assertNonNegativeInteger(revision, 'revision');

  return {
    payloadVersion: PRINT_PAYLOAD_VERSION,
    jobType: PRINT_JOB_TYPES.ORDER,
    revision,
    ticketLabel: 'ORDEN',
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    order: buildOrderSnapshot(order),
  };
}

export function buildAmendmentPrintPayload(
  order: PrintOrderSource,
  changes: readonly AmendmentChangeSource[],
  options: AmendmentPayloadOptions,
): AmendmentPrintPayload {
  const revision = options.revision ?? 0;
  assertNonNegativeInteger(revision, 'revision');

  if (changes.length === 0) {
    throw new Error('Una modificacion debe incluir al menos un cambio');
  }

  changes.forEach((change) => {
    assertOptionalNonNegativeInteger(
      change.previousQuantity,
      'change.previousQuantity',
    );
    assertOptionalNonNegativeInteger(change.quantity, 'change.quantity');
  });

  return {
    payloadVersion: PRINT_PAYLOAD_VERSION,
    jobType: PRINT_JOB_TYPES.AMENDMENT,
    revision,
    ticketLabel: 'MODIFICACION',
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    order: buildOrderSnapshot(order),
    changes: changes.map((change) => ({
      action: change.action,
      itemId: normalizeOptionalText(change.itemId),
      productId: normalizeOptionalText(change.productId),
      productName: normalizeRequiredText(change.productName, 'change.productName'),
      previousQuantity: change.previousQuantity ?? null,
      quantity: change.quantity ?? null,
      observations: normalizeOptionalText(change.observations),
    })),
    reason: normalizeRequiredText(options.reason, 'reason'),
    requestedBy: normalizeRequiredText(options.requestedBy, 'requestedBy'),
  };
}

export function buildReprintPrintPayload(
  order: PrintOrderSource,
  options: ReprintPayloadOptions,
): ReprintPrintPayload {
  const revision = options.revision ?? 0;
  assertNonNegativeInteger(revision, 'revision');

  return {
    payloadVersion: PRINT_PAYLOAD_VERSION,
    jobType: PRINT_JOB_TYPES.REPRINT,
    revision,
    ticketLabel: 'REIMPRESION',
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    order: buildOrderSnapshot(order),
    reason: normalizeRequiredText(options.reason, 'reason'),
    requestedBy: normalizeRequiredText(options.requestedBy, 'requestedBy'),
  };
}

export function buildDedupeKey(
  orderId: string,
  type: PrintJobTypeValue,
  revision: number,
): string {
  assertNonNegativeInteger(revision, 'revision');
  if (!Object.values(PRINT_JOB_TYPES).includes(type)) {
    throw new Error('type de impresion invalido');
  }
  return `${normalizeRequiredText(orderId, 'orderId')}:${type}:${revision}`;
}

export function canTransitionPrintJob(
  from: PrintJobStatusValue,
  to: PrintJobStatusValue,
): boolean {
  return PRINT_JOB_TRANSITIONS[from].includes(to);
}

export function assertPrintJobTransition(
  from: PrintJobStatusValue,
  to: PrintJobStatusValue,
): void {
  if (!canTransitionPrintJob(from, to)) {
    throw new Error(`Transicion de impresion invalida: ${from} -> ${to}`);
  }
}

export function getConfiguredAutoPrintWindowMinutes(
  rawValue = process.env.PRINT_AUTO_WINDOW_MINUTES,
): number | null {
  if (!rawValue) return DEFAULT_AUTO_PRINT_WINDOW_MINUTES;

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'disabled' || normalized === 'off') return null;

  const minutes = Number(normalized);
  assertPositiveInteger(minutes, 'PRINT_AUTO_WINDOW_MINUTES');
  return minutes;
}

export function isPrintQueueEnabled(
  rawValue = process.env.PRINT_QUEUE_ENABLED,
): boolean {
  if (!rawValue) return false;

  const normalized = rawValue.trim().toLowerCase();
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;

  throw new Error('PRINT_QUEUE_ENABLED debe ser true o false');
}

export function calculateAutoPrintUntil(
  from: Date,
  windowMinutes: number | null = getConfiguredAutoPrintWindowMinutes(),
): Date {
  if (Number.isNaN(from.getTime())) throw new Error('from contiene una fecha invalida');
  if (windowMinutes === null) return new Date('9999-12-31T23:59:59.999Z');

  assertPositiveInteger(windowMinutes, 'autoPrintWindowMinutes');
  return new Date(from.getTime() + windowMinutes * 60_000);
}

export function isAfterPrintCutover(
  orderCreatedAt: Date,
  rawCutover = process.env.PRINT_CUTOVER_AT,
): boolean {
  if (Number.isNaN(orderCreatedAt.getTime())) {
    throw new Error('orderCreatedAt contiene una fecha invalida');
  }
  if (!rawCutover) return false;

  const cutover = new Date(rawCutover);
  if (Number.isNaN(cutover.getTime())) {
    throw new Error('PRINT_CUTOVER_AT contiene una fecha invalida');
  }

  return orderCreatedAt.getTime() >= cutover.getTime();
}

export function shouldEnqueuePrintJob(
  orderCreatedAt: Date,
  options: ShouldEnqueuePrintJobOptions = {},
): boolean {
  const enabledRaw =
    options.enabled === undefined
      ? process.env.PRINT_QUEUE_ENABLED
      : options.enabled;
  if (!isPrintQueueEnabled(enabledRaw)) return false;

  const cutoverRaw =
    options.cutoverAt === undefined
      ? process.env.PRINT_CUTOVER_AT
      : options.cutoverAt;

  return cutoverRaw ? isAfterPrintCutover(orderCreatedAt, cutoverRaw) : true;
}

function buildPayloadForJob(
  order: PrintOrderSource,
  options: EnqueuePrintJobOptions,
  generatedAt: Date,
): PrintJobPayload {
  if (options.type === PRINT_JOB_TYPES.ORDER) {
    return buildOrderPrintPayload(order, {
      revision: options.revision,
      generatedAt,
    });
  }

  if (options.type === PRINT_JOB_TYPES.AMENDMENT) {
    return buildAmendmentPrintPayload(order, options.changes ?? [], {
      revision: options.revision,
      generatedAt,
      reason: options.reason ?? '',
      requestedBy: options.requestedBy ?? '',
    });
  }

  return buildReprintPrintPayload(order, {
    revision: options.revision,
    generatedAt,
    reason: options.reason ?? '',
    requestedBy: options.requestedBy ?? '',
  });
}

export async function enqueueOrderPrintJob(
  tx: PrintJobTransaction,
  order: PrintOrderSource,
  options: EnqueuePrintJobOptions,
) {
  assertNonNegativeInteger(options.revision, 'revision');

  const now = options.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new Error('now contiene una fecha invalida');

  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_PRINT_ATTEMPTS;
  assertPositiveInteger(maxAttempts, 'maxAttempts');

  const payload = buildPayloadForJob(order, options, now);
  const dedupeKey = buildDedupeKey(order.id, options.type, options.revision);
  const autoPrintWindowMinutes =
    options.autoPrintWindowMinutes === undefined
      ? getConfiguredAutoPrintWindowMinutes()
      : options.autoPrintWindowMinutes;

  return tx.printJob.upsert({
    where: { dedupeKey },
    create: {
      ordenId: order.id,
      type: options.type,
      status: PRINT_JOB_STATUSES.PENDING,
      dedupeKey,
      revision: options.revision,
      payloadVersion: PRINT_PAYLOAD_VERSION,
      payload: payload as unknown as Prisma.InputJsonValue,
      maxAttempts,
      availableAt: now,
      autoPrintUntil: calculateAutoPrintUntil(now, autoPrintWindowMinutes),
    },
    update: {},
  });
}
