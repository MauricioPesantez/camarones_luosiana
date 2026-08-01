import type { Prisma } from '@prisma/client';

export const ORDER_NUMBER_TIME_ZONE = 'America/Guayaquil';

export type DailyOrderNumberTransaction = Pick<
  Prisma.TransactionClient,
  'contadorOrdenDiaria'
>;

export interface DailyOrderNumber {
  dateKey: string;
  number: number;
}

export function getOrderDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error('La fecha de la orden no es valida');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ORDER_NUMBER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export async function allocateDailyOrderNumber(
  tx: DailyOrderNumberTransaction,
  createdAt: Date,
): Promise<DailyOrderNumber> {
  const dateKey = getOrderDateKey(createdAt);
  const counter = await tx.contadorOrdenDiaria.upsert({
    where: { fecha: dateKey },
    create: { fecha: dateKey, ultimoNumero: 1 },
    update: { ultimoNumero: { increment: 1 } },
    select: { ultimoNumero: true },
  });

  return { dateKey, number: counter.ultimoNumero };
}
