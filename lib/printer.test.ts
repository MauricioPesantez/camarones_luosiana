import assert from 'node:assert/strict';

import {
  buildOrderTicketLines,
  type OrdenComanda,
} from './printer';

const createdAt = new Date('2026-07-31T18:42:18.000Z');

function createOrder(
  overrides: Partial<OrdenComanda> = {},
): OrdenComanda {
  return {
    id: 'cm-order-a7c219',
    tipoOrden: 'local',
    nivelPicante: 'picante_1',
    numeroMesa: 8,
    nombreCliente: null,
    telefonoCliente: null,
    mesero: 'Daniel',
    observaciones: 'Servir entradas primero',
    printRevision: 0,
    total: '31.75',
    createdAt,
    items: [
      {
        cantidad: 2,
        observaciones: 'Sin cebolla',
        producto: { nombre: 'Arroz chaufa especial' },
      },
      {
        cantidad: 1,
        esCortesia: true,
        producto: { nombre: 'Wantán frito' },
      },
    ],
    ...overrides,
  };
}

function includesLine(lines: string[], expected: string): boolean {
  return lines.includes(expected);
}

function run(): void {
  const local = buildOrderTicketLines(createOrder());

  assert.equal(local[0], '='.repeat(42));
  assert.equal(local[1].trim(), 'ORDEN');
  assert.equal(local[2].trim(), 'ORDEN #a7c219  REV 0');
  assert.equal(local[3], '='.repeat(42));
  assert.equal(includesLine(local, 'Tipo: LOCAL'), true);
  assert.equal(includesLine(local, 'Picante: PICANTE 1'), true);
  assert.equal(includesLine(local, 'Mesa: 8'), true);
  assert.equal(local.some((line) => line.startsWith('Cliente:')), false);
  assert.equal(local.some((line) => line.startsWith('Telefono:')), false);
  assert.equal(includesLine(local, '2x Arroz chaufa especial'), true);
  assert.equal(includesLine(local, '  Obs: Sin cebolla'), true);
  assert.equal(includesLine(local, '1x Wantan frito [CORTESIA]'), true);
  assert.equal(includesLine(local, 'OBSERVACIONES:'), true);
  assert.equal(includesLine(local, 'TOTAL: $31.75'), true);

  const domicilio = buildOrderTicketLines(
    createOrder({
      id: 'cm-order-f3b840',
      tipoOrden: 'domicilio',
      nivelPicante: 'natural',
      numeroMesa: null,
      nombreCliente: 'Carolina M.',
      telefonoCliente: '0987654321',
    }),
  );

  assert.equal(includesLine(domicilio, 'Tipo: DOMICILIO'), true);
  assert.equal(includesLine(domicilio, 'Cliente: Carolina M.'), true);
  assert.equal(includesLine(domicilio, 'Telefono: 0987654321'), true);
  assert.equal(domicilio.some((line) => line.startsWith('Mesa:')), false);
  assert.equal(domicilio.some((line) => line.startsWith('TOTAL:')), false);

  const retirar = buildOrderTicketLines(
    createOrder({
      id: 'cm-order-c8d511',
      tipoOrden: 'para_llevar',
      numeroMesa: null,
      nombreCliente: 'Andrés Pérez',
      telefonoCliente: null,
      printRevision: 2,
    }),
  );

  assert.equal(includesLine(retirar, 'Tipo: PARA LLEVAR'), true);
  assert.equal(includesLine(retirar, 'Cliente: Andres Perez'), true);
  assert.equal(retirar.some((line) => line.startsWith('Telefono:')), false);
  assert.equal(retirar.some((line) => line.startsWith('TOTAL:')), false);
  assert.equal(retirar[2].trim(), 'ORDEN #c8d511  REV 2');

  console.log('printer format tests: ok');
}

run();
