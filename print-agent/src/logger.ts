export function log(
  level: 'info' | 'warn' | 'error',
  event: string,
  details: Record<string, unknown> = {},
): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  });

  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
}
