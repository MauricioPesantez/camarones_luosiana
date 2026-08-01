export function isDirectPrintEnabled(
  rawValue = process.env.DIRECT_PRINT_ENABLED,
): boolean {
  if (!rawValue) return true;

  const normalized = rawValue.trim().toLowerCase();
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;

  throw new Error('DIRECT_PRINT_ENABLED debe ser true o false');
}
