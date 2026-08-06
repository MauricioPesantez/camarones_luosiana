import { createHash, randomBytes } from 'node:crypto';

export function hashPaymentToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createPaymentLink(requestUrl: string): {
  token: string;
  tokenHash: string;
  url: string;
} {
  const token = randomBytes(32).toString('base64url');
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  const base = configuredBase || new URL(requestUrl).origin;
  return {
    token,
    tokenHash: hashPaymentToken(token),
    url: `${base}/ordenes/cobrar/${token}`,
  };
}

export function shouldPrintPaymentQr(order: {
  tipoOrden?: string | null;
  metodoPagoPrevisto?: string | null;
  cobrada?: boolean;
  total?: number | string | { toNumber(): number } | { toString(): string };
  montoPagado?: number | string | { toNumber(): number } | { toString(): string } | null;
  cobroUrl?: string | null;
}): boolean {
  if (!order.cobroUrl) return false;

  // Manda el saldo, no el booleano: una orden que crecio despues de pagada
  // vuelve a necesitar su QR. `cobrada` solo decide cuando no hay total, que
  // pasa en los payloads de impresion antiguos.
  const hayTotal = order.total !== undefined && order.total !== null;
  const conSaldo = hayTotal
    ? Math.round(Number(order.total) * 100) -
        Math.round(Number(order.montoPagado ?? 0) * 100) >
      0
    : !order.cobrada;
  if (!conSaldo) return false;

  if (order.tipoOrden === 'domicilio') {
    return order.metodoPagoPrevisto === 'efectivo';
  }
  return true;
}
