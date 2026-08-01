import type { AgentConfig } from './types.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es requerido`);
  return value;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}`);
  }
  return value;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (['true', '1', 'yes', 'on'].includes(raw)) return true;
  if (['false', '0', 'no', 'off'].includes(raw)) return false;
  throw new Error(`${name} debe ser true o false`);
}

export function loadConfig(): AgentConfig {
  const apiBaseUrl = required('API_BASE_URL').replace(/\/+$/, '');
  const parsedUrl = new URL(apiBaseUrl);
  if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
    throw new Error('API_BASE_URL debe usar HTTPS');
  }

  const token = required('PRINT_AGENT_TOKEN');
  if (token.length < 32) {
    throw new Error('PRINT_AGENT_TOKEN debe tener al menos 32 caracteres');
  }

  const pollTimeZone = process.env.POLL_TIME_ZONE?.trim() || 'America/Guayaquil';
  try {
    new Intl.DateTimeFormat('es-EC', { timeZone: pollTimeZone }).format();
  } catch {
    throw new Error('POLL_TIME_ZONE debe ser una zona horaria IANA valida');
  }

  return {
    apiBaseUrl,
    token,
    workerId: required('WORKER_ID'),
    printerIp: required('PRINTER_IP'),
    printerPort: integer('PRINTER_PORT', 9100, 1, 65_535),
    dryRun: boolean('DRY_RUN', true),
    pollIntervalMs: integer('POLL_INTERVAL_MS', 5_000, 500, 60_000),
    pollActiveStartHour: integer('POLL_ACTIVE_START_HOUR', 12, 0, 23),
    pollActiveEndHour: integer('POLL_ACTIVE_END_HOUR', 21, 0, 23),
    pollTimeZone,
    heartbeatIntervalMs: integer(
      'HEARTBEAT_INTERVAL_MS',
      30_000,
      5_000,
      300_000,
    ),
    requestTimeoutMs: integer('REQUEST_TIMEOUT_MS', 10_000, 1_000, 60_000),
    printerTimeoutMs: integer('PRINTER_TIMEOUT_MS', 5_000, 500, 30_000),
  };
}
