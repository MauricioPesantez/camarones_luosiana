import assert from 'node:assert/strict';

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
  const local = ticketText('local');
  assert.match(local, /ORDEN #123/);
  assert.match(local, /TOTAL: \$31\.75/);
  assert.doesNotMatch(local, /Tipo:/);
  assert.doesNotMatch(local, /Mesero:/);
  assert.doesNotMatch(ticketText('domicilio'), /TOTAL:/);
  assert.doesNotMatch(ticketText('para_llevar'), /TOTAL:/);
  assert.doesNotMatch(ticketText('domicilio'), /Mesero:/);
  assert.doesNotMatch(ticketText('para_llevar'), /Mesero:/);
  assert.doesNotMatch(ticketText('domicilio', null), /Cliente:/);

  console.log('printer ticket tests: ok');
}

run();
