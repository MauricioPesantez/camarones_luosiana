import assert from 'node:assert/strict';

import { encodeEscPosRaster } from './logo.js';
import { buildEscPosTicket } from './printer.js';
import type { PrintJobPayload } from './types.js';

function createPayload(
  type: PrintJobPayload['order']['type'],
  customerName: string | null = type === 'local' ? null : 'Carolina',
  overrides: Partial<PrintJobPayload['order']> = {},
): PrintJobPayload {
  return {
    payloadVersion: 1,
    jobType: 'ORDER',
    revision: 0,
    ticketLabel: 'ORDEN',
    generatedAt: '2026-07-31T18:42:18.000Z',
    order: {
      id: 'cm-order-a7c219',
      shortCode: 'a7c219',
      dailyNumber: 123,
      dailyDate: '2026-07-31',
      type,
      tableNumber: type === 'local' ? 8 : null,
      customerName,
      customerPhone: type === 'domicilio' ? '0987654321' : null,
      waiterName: 'Daniel',
      observations: null,
      surcharge: type === 'local' ? 0 : 1.25,
      deliveryCost: type === 'domicilio' ? 2.5 : 0,
      total: 31.75,
      createdAt: '2026-07-31T18:42:18.000Z',
      items: [
        {
          productName: 'Arroz chaufa',
          quantity: 2,
          observations: null,
          spiceLevel: 'leve',
          complimentary: false,
        },
      ],
      ...overrides,
    },
  };
}

function createAmendmentPayload(
  type: PrintJobPayload['order']['type'],
  amountDelta = 6.5,
  paymentMethod: PrintJobPayload['order']['paymentMethod'] = 'efectivo',
): PrintJobPayload {
  const base = createPayload(type, type === 'local' ? null : 'Carolina', {
    paymentMethod: type === 'domicilio' ? paymentMethod : null,
    surcharge: type === 'local' ? 0 : 1.25,
    deliveryCost: type === 'domicilio' ? 5 : 0,
    total: type === 'domicilio' ? 38 : type === 'para_llevar' ? 33 : 31.75,
  });

  return {
    ...base,
    jobType: 'AMENDMENT',
    revision: 2,
    ticketLabel: 'MODIFICACION',
    generatedAt: '2026-07-31T19:10:00.000Z',
    reason: 'Cliente agrego un producto',
    requestedBy: 'Daniel',
    changes: [
      {
        action: amountDelta >= 0 ? 'ADD' : 'REMOVE',
        productName: 'Combo Simple',
        previousQuantity: amountDelta >= 0 ? 0 : 1,
        quantity: amountDelta >= 0 ? 1 : 0,
        quantityDelta: amountDelta >= 0 ? 1 : -1,
        unitPrice: Math.abs(amountDelta),
        amountDelta,
        surchargeDelta: type === 'local' ? 0 : amountDelta >= 0 ? 1.25 : -1.25,
        observations: null,
        complimentary: false,
      },
    ],
  };
}

function ticketText(
  type: PrintJobPayload['order']['type'],
  customerName?: string | null,
  overrides?: Partial<PrintJobPayload['order']>,
): string {
  return buildEscPosTicket(
    createPayload(type, customerName, overrides),
  ).toString('ascii');
}

/** Reconstruye una linea de monto alineada a la derecha del ticket (42 columnas). */
function amountLine(label: string, amount: string): string {
  return `${label}${' '.repeat(42 - label.length - amount.length)}${amount}`;
}

function invertedLabel(label: 'MESA:' | 'TIPO:'): Buffer {
  return Buffer.concat([
    Buffer.from([0x1d, 0x42, 0x01]),
    Buffer.from(label, 'ascii'),
    Buffer.from([0x1d, 0x42, 0x00]),
  ]);
}

function invertedSelectedValue(value: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x1d, 0x42, 0x01]),
    Buffer.from(` ${value} `, 'ascii'),
    Buffer.from([0x1d, 0x42, 0x00]),
  ]);
}

function run(): void {
  const localTicket = buildEscPosTicket(createPayload('local'));
  const local = localTicket.toString('ascii');
  const rasterCommand = Buffer.from([0x1d, 0x76, 0x30, 0x00]);
  const rasterPosition = localTicket.indexOf(rasterCommand);
  const titlePosition = localTicket.indexOf(Buffer.from('ORDEN #123', 'ascii'));

  assert.ok(rasterPosition >= 0, 'El ticket debe incluir el logo rasterizado');
  assert.ok(rasterPosition < titlePosition, 'El logo debe aparecer antes del titulo');
  assert.match(local, /ORDEN #123/);
  assert.ok(
    localTicket.includes(invertedLabel('MESA:')),
    'MESA debe imprimirse con fondo negro y letras blancas',
  );
  assert.ok(local.includes(amountLine('TOTAL:', '$31.75')));
  assert.doesNotMatch(local, /Tipo:/);
  assert.doesNotMatch(local, /Mesero:/);
  assert.doesNotMatch(local, /Pago:/);
  assert.match(local, /2x Arroz chaufa/);
  assert.match(local, /Salsa Louisiana:/);
  assert.match(local, / LEVE/);
  assert.ok(
    localTicket.includes(invertedSelectedValue('LEVE')),
    'El valor de Salsa Louisiana debe imprimirse con fondo negro y letras blancas',
  );
  assert.doesNotMatch(ticketText('domicilio'), /Mesero:/);
  assert.doesNotMatch(ticketText('para_llevar'), /Mesero:/);
  assert.doesNotMatch(ticketText('domicilio', null), /Cliente:/);

  const qrUrl = 'https://pos.example.com/ordenes/cobrar/token-seguro';
  const localWithQr = buildEscPosTicket(
    createPayload('local', null, { paymentUrl: qrUrl }),
  );
  assert.ok(localWithQr.includes(Buffer.from('ESCANEA PARA COBRAR', 'ascii')));
  assert.ok(localWithQr.includes(Buffer.from(qrUrl, 'utf8')));
  assert.ok(
    localWithQr.includes(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])),
    'el ticket debe incluir el comando ESC/POS para imprimir el QR',
  );

  // Payload sin modalidad acordada (generado antes de esta funcionalidad):
  // el ticket de domicilio sigue saliendo sin montos.
  const domicilioLegacy = ticketText('domicilio');
  assert.ok(
    buildEscPosTicket(createPayload('domicilio')).includes(invertedLabel('TIPO:')),
    'TIPO debe imprimirse con fondo negro y letras blancas',
  );
  assert.doesNotMatch(domicilioLegacy, /Pago:/);
  assert.doesNotMatch(domicilioLegacy, /TOTAL:/);
  assert.doesNotMatch(domicilioLegacy, /Envio:/);

  // Domicilio en efectivo: desglose completo, el motorizado cobra el total.
  const domicilioEfectivo = ticketText('domicilio', 'Carolina', {
    paymentMethod: 'efectivo',
    surcharge: 1.25,
    deliveryCost: 5,
    total: 106.25,
  });
  assert.match(domicilioEfectivo, /Pago: EFECTIVO/);
  assert.ok(domicilioEfectivo.includes(amountLine('Subtotal productos:', '$100.00')));
  assert.ok(domicilioEfectivo.includes(amountLine('Recipientes:', '$1.25')));
  // TOTAL es lo que el local le cobra al motorizado: no incluye el envio.
  assert.ok(domicilioEfectivo.includes(amountLine('TOTAL:', '$101.25')));
  // Bloque aparte: lo que el motorizado le cobra al cliente, envio incluido.
  assert.match(domicilioEfectivo, /DELIVERY:/);
  assert.ok(domicilioEfectivo.includes(amountLine('Envio:', '$5.00')));
  assert.ok(domicilioEfectivo.includes(amountLine('Cobra al cliente:', '$106.25')));
  // El envio va despues del TOTAL, nunca antes: sumarlo al total seria un error.
  assert.ok(
    domicilioEfectivo.indexOf('TOTAL:') < domicilioEfectivo.indexOf('Envio:'),
  );

  // Domicilio por transferencia: solo el envio que se le entrega al motorizado.
  const domicilioTransferencia = ticketText('domicilio', 'Carolina', {
    paymentMethod: 'transferencia',
    surcharge: 1.25,
    deliveryCost: 5,
    total: 106.25,
  });
  assert.match(domicilioTransferencia, /Pago: TRANSFERENCIA/);
  assert.ok(domicilioTransferencia.includes(amountLine('Envio:', '$5.00')));
  assert.doesNotMatch(domicilioTransferencia, /TOTAL:/);
  assert.doesNotMatch(domicilioTransferencia, /Subtotal productos:/);

  const transferenciaSinQr = buildEscPosTicket(
    createPayload('domicilio', 'Carolina', {
      paymentMethod: 'transferencia',
      paymentUrl: null,
    }),
  ).toString('ascii');
  assert.doesNotMatch(transferenciaSinQr, /ESCANEA PARA COBRAR/);

  // Para llevar: desglose sin envio y sin modalidad acordada.
  const paraLlevar = ticketText('para_llevar', 'Carolina', {
    surcharge: 1.25,
    deliveryCost: 0,
    total: 46.25,
  });
  assert.doesNotMatch(paraLlevar, /Pago:/);
  assert.ok(paraLlevar.includes(amountLine('Subtotal productos:', '$45.00')));
  assert.ok(paraLlevar.includes(amountLine('Recipientes:', '$1.25')));
  assert.ok(paraLlevar.includes(amountLine('TOTAL:', '$46.25')));
  assert.doesNotMatch(paraLlevar, /Envio:/);

  // Las modificaciones imprimen únicamente el delta monetario. Los cargos fijos
  // ya cobrados o acordados nunca se repiten, sin importar el tipo de orden.
  const amendmentCases = [
    { type: 'local', paymentMethod: null },
    { type: 'para_llevar', paymentMethod: null },
    { type: 'domicilio', paymentMethod: 'efectivo' },
    { type: 'domicilio', paymentMethod: 'transferencia' },
  ] as const;
  for (const { type, paymentMethod } of amendmentCases) {
    const amendment = buildEscPosTicket(
      createAmendmentPayload(type, 6.5, paymentMethod),
    ).toString('ascii');
    assert.match(amendment, /MODIFICACION/);
    assert.match(amendment, /ORDEN #123 31-07 REV 2/);
    assert.match(amendment, /\+ 1x Combo Simple/);
    assert.ok(amendment.includes(amountLine('  Cambio:', '$6.50')));
    assert.ok(amendment.includes(amountLine('AJUSTE PRODUCTOS:', '$6.50')));
    if (type !== 'local') {
      assert.ok(amendment.includes(amountLine('AJUSTE ENVASES:', '$1.25')));
      assert.ok(amendment.includes(amountLine('AJUSTE TOTAL:', '$7.75')));
    }
    assert.doesNotMatch(amendment, /Recipientes:/);
    assert.doesNotMatch(amendment, /Envio:/);
    assert.doesNotMatch(amendment, /Cobra al cliente:/);
    assert.doesNotMatch(amendment, /^TOTAL:/m);

    if (type === 'local') {
      assert.doesNotMatch(amendment, /NO REPETIR ENVIO NI RECIPIENTES/);
    } else {
      assert.match(amendment, /NO REPETIR ENVIO NI RECIPIENTES/);
    }
  }

  const removal = buildEscPosTicket(
    createAmendmentPayload('para_llevar', -6.5),
  ).toString('ascii');
  assert.match(removal, /- 1x Combo Simple/);
  assert.ok(removal.includes(amountLine('AJUSTE PRODUCTOS:', '-$6.50')));
  assert.ok(removal.includes(amountLine('AJUSTE ENVASES:', '-$1.25')));

  const legacyAmendment = createAmendmentPayload('domicilio');
  if (legacyAmendment.changes?.[0]) {
    delete legacyAmendment.changes[0].quantityDelta;
    delete legacyAmendment.changes[0].unitPrice;
    delete legacyAmendment.changes[0].amountDelta;
  }
  const legacyAmendmentText = buildEscPosTicket(legacyAmendment).toString('ascii');
  assert.match(legacyAmendmentText, /AJUSTE NO DISPONIBLE - REVISAR/);
  assert.doesNotMatch(legacyAmendmentText, /Envio:/);

  const oneBlackPixel = encodeEscPosRaster(
    8,
    1,
    new Uint8Array([
      0, 0, 0, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ]),
  );
  assert.equal(oneBlackPixel.at(-1), 0x80);

  console.log('printer ticket tests: ok');
}

run();
