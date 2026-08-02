import assert from 'node:assert/strict';

import {
  buildOrderTicketLines,
  type OrdenComanda,
} from './printer';
import { NIVELES_PICANTE, calcularRecargoEnvases } from '../types/orden';

const createdAt = new Date('2026-07-31T18:42:18.000Z');

function createOrder(
  overrides: Partial<OrdenComanda> = {},
): OrdenComanda {
  return {
    id: 'cm-order-a7c219',
    numeroDiario: 123,
    tipoOrden: 'local',
    nivelPicante: null,
    numeroMesa: 8,
    nombreCliente: null,
    telefonoCliente: null,
    mesero: 'Daniel',
    observaciones: 'Servir entradas primero',
    printRevision: 0,
    recargo: null,
    costoEnvio: null,
    metodoPagoPrevisto: null,
    total: '31.75',
    createdAt,
    items: [
      {
        cantidad: 2,
        observaciones: 'Sin cebolla',
        nivelPicante: 'leve',
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

/** Reconstruye una linea de monto alineada a la derecha del ticket (42 columnas). */
function amountLine(label: string, amount: string): string {
  return `${label}${' '.repeat(42 - label.length - amount.length)}${amount}`;
}

function run(): void {
  const itemsParaRecargo = [
    { cantidad: 2, categoria: 'Combos' },
    { cantidad: 3, categoria: 'Bebidas' },
    { cantidad: 1, categoria: 'Combo' },
  ];
  assert.equal(calcularRecargoEnvases('local', itemsParaRecargo), 0);
  assert.equal(calcularRecargoEnvases('para_llevar', itemsParaRecargo), 3.75);
  assert.equal(calcularRecargoEnvases('domicilio', itemsParaRecargo), 3.75);
  assert.deepEqual(
    NIVELES_PICANTE.slice(0, 2).map((nivel) => nivel.value),
    ['natural', 'leve'],
  );

  const local = buildOrderTicketLines(createOrder());

  assert.equal(local[0], '='.repeat(42));
  assert.equal(local[1].trim(), 'ORDEN #123');
  assert.equal(local[2], '='.repeat(42));
  assert.equal(local.some((line) => line.startsWith('Tipo:')), false);
  assert.equal(includesLine(local, '  Salsa Louisiana: LEVE'), true);
  assert.equal(includesLine(local, 'Mesa: 8'), true);
  assert.equal(local.some((line) => line.startsWith('Mesero:')), false);
  assert.equal(local.some((line) => line.startsWith('Cliente:')), false);
  assert.equal(local.some((line) => line.startsWith('Telefono:')), false);
  assert.equal(includesLine(local, '2x Arroz chaufa especial'), true);
  assert.equal(includesLine(local, '  Obs: Sin cebolla'), true);
  assert.equal(includesLine(local, '1x Wantan frito [CORTESIA]'), true);
  assert.equal(includesLine(local, 'OBSERVACIONES:'), true);
  // El picante se imprime inmediatamente junto al combo correspondiente.
  assert.ok(
    local.indexOf('2x Arroz chaufa especial') <
      local.indexOf('  Salsa Louisiana: LEVE'),
  );
  assert.ok(
    local.indexOf('  Salsa Louisiana: LEVE') <
      local.indexOf('  Obs: Sin cebolla'),
  );
  assert.equal(includesLine(local, amountLine('TOTAL:', '$31.75')), true);
  assert.equal(local.some((line) => line.startsWith('Pago:')), false);
  assert.equal(local.some((line) => line.startsWith('Subtotal productos:')), false);

  const domicilio = buildOrderTicketLines(
    createOrder({
      id: 'cm-order-f3b840',
      numeroDiario: 124,
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
  assert.equal(domicilio.some((line) => line.startsWith('Mesero:')), false);
  // Sin modalidad acordada (orden previa a la funcionalidad) no se imprimen montos.
  assert.equal(domicilio.some((line) => line.startsWith('Pago:')), false);
  assert.equal(domicilio.some((line) => line.startsWith('TOTAL:')), false);
  assert.equal(domicilio.some((line) => line.startsWith('Envio:')), false);

  const domicilioSinNombre = buildOrderTicketLines(
    createOrder({
      tipoOrden: 'domicilio',
      numeroMesa: null,
      nombreCliente: '   ',
      telefonoCliente: '0987654321',
    }),
  );
  assert.equal(
    domicilioSinNombre.some((line) => line.startsWith('Cliente:')),
    false,
  );

  // Domicilio en efectivo: el motorizado cobra el total al cliente, asi que el
  // ticket lleva el desglose completo.
  const domicilioEfectivo = buildOrderTicketLines(
    createOrder({
      tipoOrden: 'domicilio',
      numeroMesa: null,
      nombreCliente: 'Carolina M.',
      telefonoCliente: '0987654321',
      recargo: '1.25',
      costoEnvio: '5.00',
      metodoPagoPrevisto: 'efectivo',
      total: '106.25',
    }),
  );

  assert.equal(includesLine(domicilioEfectivo, 'Pago: EFECTIVO'), true);
  assert.equal(
    includesLine(domicilioEfectivo, amountLine('Subtotal productos:', '$100.00')),
    true,
  );
  assert.equal(
    includesLine(domicilioEfectivo, amountLine('Recipientes:', '$1.25')),
    true,
  );
  // TOTAL es lo que el local le cobra al motorizado: no incluye el envio.
  assert.equal(
    includesLine(domicilioEfectivo, amountLine('TOTAL:', '$101.25')),
    true,
  );
  // Bloque aparte: lo que el motorizado le cobra al cliente, envio incluido.
  assert.equal(includesLine(domicilioEfectivo, 'DELIVERY:'), true);
  assert.equal(includesLine(domicilioEfectivo, amountLine('Envio:', '$5.00')), true);
  assert.equal(
    includesLine(domicilioEfectivo, amountLine('Cobra al cliente:', '$106.25')),
    true,
  );
  // El envio va despues del TOTAL, nunca antes: sumarlo al total seria un error.
  assert.ok(
    domicilioEfectivo.findIndex((line) => line.startsWith('TOTAL:')) <
      domicilioEfectivo.findIndex((line) => line.startsWith('Envio:')),
  );

  // Domicilio por transferencia: lo unico que se mueve en el local es el envio
  // que hay que entregarle al motorizado.
  const domicilioTransferencia = buildOrderTicketLines(
    createOrder({
      tipoOrden: 'domicilio',
      numeroMesa: null,
      nombreCliente: 'Carolina M.',
      telefonoCliente: '0987654321',
      recargo: '1.25',
      costoEnvio: '5.00',
      metodoPagoPrevisto: 'transferencia',
      total: '106.25',
    }),
  );

  assert.equal(includesLine(domicilioTransferencia, 'Pago: TRANSFERENCIA'), true);
  assert.equal(
    includesLine(domicilioTransferencia, amountLine('Envio:', '$5.00')),
    true,
  );
  assert.equal(
    domicilioTransferencia.some((line) => line.startsWith('TOTAL:')),
    false,
  );
  assert.equal(
    domicilioTransferencia.some((line) => line.startsWith('Subtotal productos:')),
    false,
  );

  const retirar = buildOrderTicketLines(
    createOrder({
      id: 'cm-order-c8d511',
      numeroDiario: 125,
      tipoOrden: 'para_llevar',
      numeroMesa: null,
      nombreCliente: 'Andrés Pérez',
      telefonoCliente: null,
      printRevision: 2,
      recargo: '1.25',
      total: '46.25',
    }),
  );

  assert.equal(includesLine(retirar, 'Tipo: PARA LLEVAR'), true);
  assert.equal(includesLine(retirar, 'Cliente: Andres Perez'), true);
  assert.equal(retirar.some((line) => line.startsWith('Telefono:')), false);
  assert.equal(retirar.some((line) => line.startsWith('Mesero:')), false);
  // El metodo de pago en para llevar se decide al cobrar, no al crear.
  assert.equal(retirar.some((line) => line.startsWith('Pago:')), false);
  assert.equal(
    includesLine(retirar, amountLine('Subtotal productos:', '$45.00')),
    true,
  );
  assert.equal(includesLine(retirar, amountLine('Recipientes:', '$1.25')), true);
  assert.equal(includesLine(retirar, amountLine('TOTAL:', '$46.25')), true);
  assert.equal(retirar.some((line) => line.startsWith('Envio:')), false);
  assert.equal(retirar[1].trim(), 'ORDEN #125');

  // Todas las lineas de monto quedan alineadas al ancho del ticket.
  for (const line of [...domicilioEfectivo, ...retirar]) {
    if (line.includes('$')) assert.equal(line.length, 42);
  }

  console.log('printer format tests: ok');
}

run();
