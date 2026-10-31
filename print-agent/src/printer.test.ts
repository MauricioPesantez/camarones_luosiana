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

  const checklist = createPayload('local', null, {
    observations: 'Incluir cubiertos',
    items: [
      { productName: 'Combo Mixto Small', quantity: 2, spiceLevel: 'natural', observations: 'Salsa aparte', complimentary: false },
      { productName: 'Combo Simple', quantity: 1, spiceLevel: 'picante_3', observations: null, complimentary: false },
      { productName: 'Chorizo', quantity: 1, observations: null, complimentary: false },
      { productName: 'Gaseosa Personal Coca', quantity: 1, observations: null, complimentary: true },
    ],
  });
  const checklistTicket = buildEscPosTicket(checklist);
  const checklistText = checklistTicket.toString('ascii');
  for (const product of ['[ ] 2x Combo Mixto Small', '[ ] 1x Combo Simple', '[ ] 1x Chorizo', '[ ] 1x Gaseosa Personal Coca [CORTESIA]']) {
    assert.ok(checklistText.includes(product));
  }
  for (const level of ['NATURAL', 'PICANTE 3']) {
    assert.ok(checklistTicket.includes(Buffer.concat([
      Buffer.from('  [ ] Salsa Louisiana: ', 'ascii'), invertedSelectedValue(level),
    ])));
  }
  assert.match(checklistText, /  \[ \] Obs: Salsa aparte/);
  assert.match(checklistText, /\[ \] OBSERVACIONES:\n    Incluir cubiertos/);
  assert.equal((checklistText.match(/Responsable:/g) ?? []).length, 1);

  const legacySpice = createPayload('local', null, {
    spiceLevel: 'leve',
    items: [{ productName: 'Combo', quantity: 1, observations: null, complimentary: false }],
  });
  assert.ok(buildEscPosTicket(legacySpice).includes(Buffer.concat([
    Buffer.from('[ ] Salsa Louisiana: ', 'ascii'), invertedSelectedValue('LEVE'),
  ])));
  const noSpice = createPayload('local', null, { observations: '  ', items: [
    { productName: 'Chorizo', quantity: 1, observations: ' ', complimentary: false },
  ] });
  Object.assign(noSpice.order.items[0], { spiceLevel: 'desconocido' });
  const noSpiceText = buildEscPosTicket(noSpice).toString('ascii');
  assert.doesNotMatch(noSpiceText, /Salsa Louisiana:|OBSERVACIONES:|Obs:/);

  // Los nombres e indicaciones largos no pierden texto ni repiten casillas.
  const longName = 'Combo mixto con camarón jumbo y langostinos ' + 'X'.repeat(70);
  const longPayload = createPayload('local', null, { items: [
    { productName: longName, quantity: 2, observations: 'Salsa aparte\n' + 'Y'.repeat(70), complimentary: true },
  ] });
  const longText = buildEscPosTicket(longPayload).toString('ascii');
  const body = longText.slice(longText.indexOf('='.repeat(42)), longText.lastIndexOf('='.repeat(42)) + 42)
    .replace(/\x1dB[\x00\x01]/g, '');
  assert.ok(body.split('\n').every((line) => line.length <= 42));
  assert.equal((body.match(/\[ \]/g) ?? []).length, 2);
  const productBlock = body.slice(body.indexOf('[ ] 2x'), body.indexOf('  [ ] Obs:'));
  assert.equal(productBlock.replace(/\s/g, ''), ('[ ] 2x ' + longName.replace('ó', 'o') + ' [CORTESIA]').replace(/\s/g, ''));
  assert.ok(body.replace(/\s/g, '').includes('Y'.repeat(70)));

  for (const delta of [1, -1]) {
    const changePayload = createAmendmentPayload('para_llevar', delta * 6.5);
    changePayload.order = legacySpice.order;
    changePayload.order.observations = 'Incluir cubiertos';
    Object.assign(changePayload.changes![0], { spiceLevel: 'picante_2', observations: 'Salsa aparte' });
    const changeText = buildEscPosTicket(changePayload).toString('ascii');
    assert.doesNotMatch(changeText, /\[ \] 1x Combo\n/);
    assert.doesNotMatch(changeText, / LEVE /);
    assert.ok(changeText.includes('OBSERVACIONES (REFERENCIA):'));
    if (delta > 0) {
      assert.match(changeText, /\[ \] \+ 1x Combo Simple/);
      assert.match(changeText, /  \[ \] Salsa Louisiana:/);
      assert.match(changeText, /  \[ \] Obs: Salsa aparte/);
    } else {
      assert.match(changeText, /\[ \] RETIRAR \/ NO PREPARAR:\n    - 1x Combo Simple/);
      assert.doesNotMatch(changeText, /\[ \] Salsa Louisiana:|\[ \] Obs:/);
      assert.equal((changeText.match(/\[ \]/g) ?? []).length, 1);
    }
  }
  // Una reducción UPDATE también es retiro, aunque el producto siga en la orden.
  const reduction = createAmendmentPayload('local', -6.5);
  Object.assign(reduction.changes![0], { action: 'UPDATE', previousQuantity: 3, quantity: 2 });
  assert.match(buildEscPosTicket(reduction).toString('ascii'), /RETIRAR \/ NO PREPARAR:/);

  const reprint: PrintJobPayload = { ...checklist, jobType: 'REPRINT', ticketLabel: 'REIMPRESION', reason: 'Papel extraviado', requestedBy: 'Daniel', revision: 3 };
  const reprintText = buildEscPosTicket(reprint).toString('ascii');
  assert.match(reprintText, /REIMPRESION/);
  assert.match(reprintText, /COPIA - NO PREPARAR DE NUEVO/);
  assert.match(reprintText, /Motivo: Papel extraviado/);
  assert.match(reprintText, /Solicita: Daniel/);
  assert.equal((reprintText.match(/\[ \]/g) ?? []).length, 8);
  assert.equal((reprintText.match(/Responsable:/g) ?? []).length, 1);

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
