export class AccountValidationError extends Error {}

/** Convert an amount to integer cents without silently rounding input. */
export function moneyCents(value: unknown, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new AccountValidationError('El monto debe ser un número válido');
  const cents = value * 100;
  if ((!allowZero && value <= 0) || (allowZero && value < 0) || value > 99999999.99 || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) {
    throw new AccountValidationError('El monto debe ser válido y tener hasta dos decimales');
  }
  return Math.round(cents);
}

export function accountTotals(cents: number) {
  return { saldo: cents / 100, pendiente: Math.max(cents, 0) / 100, saldoAFavor: Math.max(-cents, 0) / 100 };
}

export function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 500) throw new AccountValidationError(`${field} es obligatorio`);
  return value.trim();
}
