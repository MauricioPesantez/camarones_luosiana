import assert from 'node:assert/strict';

import {
  PRINT_JOB_TYPES,
  PRINT_JOB_STATUSES,
  assertPrintJobTransition,
  buildAmendmentPrintPayload,
  buildDedupeKey,
  buildOrderPrintPayload,
  buildReprintPrintPayload,
  calculateAutoPrintUntil,
  canTransitionPrintJob,
  enqueueOrderPrintJob,
  getConfiguredAutoPrintWindowMinutes,
  isAfterPrintCutover,
  isPrintQueueEnabled,
  shouldEnqueuePrintJob,
  type PrintJobTransaction,
  type PrintOrderSource,
} from './print-jobs';

const FIXED_NOW = new Date('2026-07-31T19:00:00.000Z');

function createOrder(): PrintOrderSource {
  return {
    id: 'cm-order-abcdef',
    numeroDiario: 123,
    tipoOrden: 'domicilio',
    nivelPicante: 'picante_2',
    numeroMesa: null,
    nombreCliente: 'Ana',
    telefonoCliente: '0999999999',
    mesero: 'Maria',
    observaciones: 'Sin picante',
    recargo: '1.25',
    costoEnvio: { toNumber: () => 2 },
    total: '16.25',
    createdAt: new Date('2026-07-31T18:58:00.000Z'),
    items: [
      {
        id: 'item-1',
        cantidad: 2,
        observaciones: 'Sin cebolla',
        precioUnitario: '6.50',
        subtotal: '13.00',
        producto: { id: 'product-1', nombre: 'Combo Simple' },
      },
    ],
  };
}

async function run(): Promise<void> {
  const order = createOrder();
  const payload = buildOrderPrintPayload(order, {
    revision: 0,
    generatedAt: FIXED_NOW,
  });

  assert.equal(payload.jobType, 'ORDER');
  assert.equal(payload.ticketLabel, 'ORDEN');
  assert.equal(payload.order.shortCode, 'abcdef');
  assert.equal(payload.order.dailyNumber, 123);
  assert.equal(payload.order.spiceLevel, 'picante_2');
  assert.equal(payload.order.surcharge, 1.25);
  assert.equal(payload.order.total, 16.25);
  assert.equal(payload.order.items[0].unitPrice, 6.5);
  assert.equal(payload.generatedAt, FIXED_NOW.toISOString());

  order.items[0].producto.nombre = 'Nombre cambiado';
  assert.equal(
    payload.order.items[0].productName,
    'Combo Simple',
    'el payload debe ser un snapshot independiente de la orden',
  );

  const amendment = buildAmendmentPrintPayload(
    createOrder(),
    [
      {
        action: 'ADD',
        productId: 'product-2',
        productName: 'Papas Fritas',
        quantity: 1,
      },
    ],
    {
      revision: 1,
      generatedAt: FIXED_NOW,
      reason: 'Solicitud del cliente',
      requestedBy: 'Maria',
    },
  );

  assert.equal(amendment.ticketLabel, 'MODIFICACION');
  assert.equal(amendment.changes.length, 1);
  assert.equal(amendment.changes[0].productName, 'Papas Fritas');
  assert.equal(amendment.reason, 'Solicitud del cliente');

  const reprint = buildReprintPrintPayload(createOrder(), {
    revision: 2,
    generatedAt: FIXED_NOW,
    reason: 'Ticket ilegible',
    requestedBy: 'Admin',
  });

  assert.equal(reprint.ticketLabel, 'REIMPRESION');
  assert.equal(reprint.requestedBy, 'Admin');

  assert.equal(
    buildDedupeKey('cm-order-abcdef', PRINT_JOB_TYPES.AMENDMENT, 1),
    'cm-order-abcdef:AMENDMENT:1',
  );
  assert.throws(
    () => buildDedupeKey('cm-order-abcdef', PRINT_JOB_TYPES.ORDER, -1),
    /revision/,
  );

  assert.equal(
    canTransitionPrintJob(
      PRINT_JOB_STATUSES.PENDING,
      PRINT_JOB_STATUSES.PROCESSING,
    ),
    true,
  );
  assert.equal(
    canTransitionPrintJob(
      PRINT_JOB_STATUSES.SUCCEEDED,
      PRINT_JOB_STATUSES.RETRY,
    ),
    false,
  );
  assert.throws(
    () =>
      assertPrintJobTransition(
        PRINT_JOB_STATUSES.DISCARDED,
        PRINT_JOB_STATUSES.PENDING,
      ),
    /Transicion de impresion invalida/,
  );

  assert.equal(getConfiguredAutoPrintWindowMinutes(''), 5);
  assert.equal(getConfiguredAutoPrintWindowMinutes('10'), 10);
  assert.equal(getConfiguredAutoPrintWindowMinutes('off'), null);
  assert.equal(
    calculateAutoPrintUntil(FIXED_NOW, 5).toISOString(),
    '2026-07-31T19:05:00.000Z',
  );
  assert.equal(calculateAutoPrintUntil(FIXED_NOW, null).getUTCFullYear(), 9999);

  assert.equal(
    isAfterPrintCutover(
      new Date('2026-07-31T19:00:00.000Z'),
      '2026-07-31T18:00:00.000Z',
    ),
    true,
  );
  assert.equal(isAfterPrintCutover(FIXED_NOW, ''), false);
  assert.equal(isPrintQueueEnabled(''), false);
  assert.equal(isPrintQueueEnabled('true'), true);
  assert.equal(isPrintQueueEnabled('OFF'), false);
  assert.throws(() => isPrintQueueEnabled('quizas'), /true o false/);
  assert.equal(
    shouldEnqueuePrintJob(FIXED_NOW, { enabled: 'true' }),
    true,
  );
  assert.equal(
    shouldEnqueuePrintJob(FIXED_NOW, {
      enabled: 'true',
      cutoverAt: '2026-07-31T20:00:00.000Z',
    }),
    false,
  );
  assert.equal(
    shouldEnqueuePrintJob(FIXED_NOW, {
      enabled: 'false',
      cutoverAt: '2026-07-31T18:00:00.000Z',
    }),
    false,
  );

  let capturedArguments: Record<string, unknown> | undefined;
  const tx = {
    printJob: {
      upsert: async (args: Record<string, unknown>) => {
        capturedArguments = args;
        return args;
      },
    },
  } as unknown as PrintJobTransaction;

  await enqueueOrderPrintJob(tx, createOrder(), {
    type: PRINT_JOB_TYPES.ORDER,
    revision: 0,
    now: FIXED_NOW,
    autoPrintWindowMinutes: 5,
  });

  const where = capturedArguments?.where as { dedupeKey: string };
  const create = capturedArguments?.create as {
    status: string;
    dedupeKey: string;
    availableAt: Date;
    autoPrintUntil: Date;
    payload: { jobType: string };
  };

  assert.equal(where.dedupeKey, 'cm-order-abcdef:ORDER:0');
  assert.equal(create.status, 'PENDING');
  assert.equal(create.dedupeKey, where.dedupeKey);
  assert.equal(create.availableAt.toISOString(), FIXED_NOW.toISOString());
  assert.equal(create.autoPrintUntil.toISOString(), '2026-07-31T19:05:00.000Z');
  assert.equal(create.payload.jobType, 'ORDER');

  await enqueueOrderPrintJob(tx, createOrder(), {
    type: PRINT_JOB_TYPES.REPRINT,
    revision: 3,
    now: FIXED_NOW,
    autoPrintWindowMinutes: null,
    reason: 'Prueba manual',
    requestedBy: 'Admin',
  });

  const disabledWindowCreate = capturedArguments?.create as {
    autoPrintUntil: Date;
  };
  assert.equal(disabledWindowCreate.autoPrintUntil.getUTCFullYear(), 9999);

  assert.throws(
    () =>
      buildAmendmentPrintPayload(createOrder(), [], {
        revision: 1,
        reason: 'Cambio',
        requestedBy: 'Maria',
      }),
    /al menos un cambio/,
  );

  console.log('print-jobs: todas las pruebas pasaron');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
