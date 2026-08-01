import assert from 'node:assert/strict';

import {
  allocateDailyOrderNumber,
  getOrderDateKey,
  type DailyOrderNumberTransaction,
} from './daily-order-number';

async function run(): Promise<void> {
  assert.equal(
    getOrderDateKey(new Date('2026-08-01T04:59:59.000Z')),
    '2026-07-31',
  );
  assert.equal(
    getOrderDateKey(new Date('2026-08-01T05:00:00.000Z')),
    '2026-08-01',
  );
  assert.throws(() => getOrderDateKey(new Date('invalid')), /no es valida/);

  let current = 0;
  const dates: string[] = [];
  const tx = {
    contadorOrdenDiaria: {
      upsert: async (args: {
        where: { fecha: string };
        create: { fecha: string; ultimoNumero: number };
      }) => {
        dates.push(args.where.fecha);
        current = current === 0 ? args.create.ultimoNumero : current + 1;
        return { ultimoNumero: current };
      },
    },
  } as unknown as DailyOrderNumberTransaction;

  const first = await allocateDailyOrderNumber(
    tx,
    new Date('2026-08-01T04:00:00.000Z'),
  );
  const second = await allocateDailyOrderNumber(
    tx,
    new Date('2026-08-01T04:01:00.000Z'),
  );

  assert.deepEqual(first, { dateKey: '2026-07-31', number: 1 });
  assert.deepEqual(second, { dateKey: '2026-07-31', number: 2 });
  assert.deepEqual(dates, ['2026-07-31', '2026-07-31']);

  console.log('daily order number tests: ok');
}

void run();
