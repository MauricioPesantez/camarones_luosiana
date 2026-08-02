import assert from 'node:assert/strict';

import {
  authenticatePrintAgent,
  getPrintLeaseSeconds,
  normalizeWorkerId,
} from './print-agent-auth';
import {
  getRetryDelaySeconds,
  sanitizePrintErrorCode,
  sanitizePrintErrorMessage,
} from './print-agent-jobs';

function requestWithToken(token?: string): Request {
  return new Request('https://example.com/api/print-agent/claim', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function run(): void {
  const secret = 'a'.repeat(64);
  assert.deepEqual(authenticatePrintAgent(requestWithToken(secret), secret), {
    ok: true,
  });
  assert.equal(
    authenticatePrintAgent(requestWithToken('incorrecto'), secret).ok,
    false,
  );
  assert.equal(authenticatePrintAgent(requestWithToken(), '').ok, false);

  assert.equal(normalizeWorkerId(' cocina-ubuntu-01 '), 'cocina-ubuntu-01');
  assert.throws(() => normalizeWorkerId('id con espacios'), /workerId/);
  assert.equal(getPrintLeaseSeconds(''), 30);
  assert.equal(getPrintLeaseSeconds('45'), 45);
  assert.throws(() => getPrintLeaseSeconds('5'), /entre 10 y 300/);

  assert.equal(getRetryDelaySeconds(1), 5);
  assert.equal(getRetryDelaySeconds(2), 15);
  assert.equal(getRetryDelaySeconds(20), 300);
  assert.throws(() => getRetryDelaySeconds(0), /attempt/);
  assert.equal(sanitizePrintErrorCode('ehost unreachable!'), 'EHOST_UNREACHABLE_');
  assert.equal(
    sanitizePrintErrorMessage('Error\ncon\tcontrol'),
    'Error con control',
  );
  assert.equal(sanitizePrintErrorMessage('x'.repeat(600)).length, 500);

  console.log('print-agent domain tests: ok');
}

run();
