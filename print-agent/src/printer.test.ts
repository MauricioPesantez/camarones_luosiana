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
      type,
      spiceLevel: 'natural',
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
          complimentary: false,
        },
      ],
      ...overrides,
    },
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

function run(): void {
  const localTicket = buildEscPosTicket(createPayload('local'));
  const local = localTicket.toString('ascii');
  const rasterCommand = Buffer.from([0x1d, 0x76, 0x30, 0x00]);
  const rasterPosition = localTicket.indexOf(rasterCommand);
  const titlePosition = localTicket.indexOf(Buffer.from('ORDEN #123', 'ascii'));

  assert.ok(rasterPosition >= 0, 'El ticket debe incluir el logo rasterizado');
  assert.ok(rasterPosition < titlePosition, 'El logo debe aparecer antes del titulo');
  assert.match(local, /ORDEN #123/);
  assert.ok(local.includes(amountLine('TOTAL:', '$31.75')));
  assert.doesNotMatch(local, /Tipo:/);
  assert.doesNotMatch(local, /Mesero:/);
  assert.doesNotMatch(local, /Pago:/);
  assert.doesNotMatch(ticketText('domicilio'), /Mesero:/);
  assert.doesNotMatch(ticketText('para_llevar'), /Mesero:/);
  assert.doesNotMatch(ticketText('domicilio', null), /Cliente:/);

  // Payload sin modalidad acordada (generado antes de esta funcionalidad):
  // el ticket de domicilio sigue saliendo sin montos.
  const domicilioLegacy = ticketText('domicilio');
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
