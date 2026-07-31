import { createHash, timingSafeEqual } from 'node:crypto';

const WORKER_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,100}$/;

export type PrintAgentAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function authenticatePrintAgent(
  request: Request,
  configuredToken = process.env.PRINT_AGENT_TOKEN,
): PrintAgentAuthResult {
  const expected = configuredToken?.trim();
  if (!expected || expected.length < 32) {
    return {
      ok: false,
      status: 503,
      error: 'La credencial del agente de impresion no esta configurada',
    };
  }

  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const received = match?.[1]?.trim() ?? '';

  if (!received || !timingSafeEqual(digest(received), digest(expected))) {
    return { ok: false, status: 401, error: 'Credencial de agente invalida' };
  }

  return { ok: true };
}

export function normalizeWorkerId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('workerId es requerido');
  }

  const workerId = value.trim();
  if (!WORKER_ID_PATTERN.test(workerId)) {
    throw new Error(
      'workerId debe tener entre 1 y 100 caracteres alfanumericos, punto, guion, guion bajo o dos puntos',
    );
  }

  return workerId;
}

export function getPrintLeaseSeconds(
  rawValue = process.env.PRINT_LEASE_SECONDS,
): number {
  if (!rawValue) return 30;

  const seconds = Number(rawValue);
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 300) {
    throw new Error('PRINT_LEASE_SECONDS debe ser un entero entre 10 y 300');
  }

  return seconds;
}
