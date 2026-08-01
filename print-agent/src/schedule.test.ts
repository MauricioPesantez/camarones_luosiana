import assert from 'node:assert/strict';

import { isPollingActive } from './schedule.js';

const schedule = {
  startHour: 12,
  endHour: 21,
  timeZone: 'America/Guayaquil',
};

assert.equal(
  isPollingActive(new Date('2026-08-01T16:59:59.000Z'), schedule),
  false,
);
assert.equal(
  isPollingActive(new Date('2026-08-01T17:00:00.000Z'), schedule),
  true,
);
assert.equal(
  isPollingActive(new Date('2026-08-02T01:59:59.000Z'), schedule),
  true,
);
assert.equal(
  isPollingActive(new Date('2026-08-02T02:00:00.000Z'), schedule),
  false,
);

console.log('poll schedule tests: ok');
