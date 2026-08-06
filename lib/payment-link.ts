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
  cobroUrl?: string | null;
}): boolean {
  if (!order.cobroUrl || order.cobrada) return false;
  if (order.tipoOrden === 'domicilio') {
    return order.metodoPagoPrevisto === 'efectivo';
  }
  return true;
}
