import assert from 'node:assert/strict';

import { encodeEscPosRaster } from './logo.js';
import { buildEscPosTicket } from './printer.js';
import type { PrintJobPayload } from './types.js';

function createPayload(
  type: PrintJobPayload['order']['type'],
  customerName: string | null = type === 'local' ? null : 'Carolina',
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
    },
  };
}

function ticketText(
  type: PrintJobPayload['order']['type'],
  customerName?: string | null,
): string {
  return buildEscPosTicket(createPayload(type, customerName)).toString('ascii');
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
  assert.match(local, /TOTAL: \$31\.75/);
  assert.doesNotMatch(local, /Tipo:/);
  assert.doesNotMatch(local, /Mesero:/);
  assert.doesNotMatch(ticketText('domicilio'), /TOTAL:/);
  assert.doesNotMatch(ticketText('para_llevar'), /TOTAL:/);
  assert.doesNotMatch(ticketText('domicilio'), /Mesero:/);
  assert.doesNotMatch(ticketText('para_llevar'), /Mesero:/);
  assert.doesNotMatch(ticketText('domicilio', null), /Cliente:/);

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
