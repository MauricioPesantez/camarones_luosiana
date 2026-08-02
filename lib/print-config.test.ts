import assert from 'node:assert/strict';

import { isDirectPrintEnabled } from './print-config';

assert.equal(isDirectPrintEnabled(''), true);
assert.equal(isDirectPrintEnabled('true'), true);
assert.equal(isDirectPrintEnabled('ON'), true);
assert.equal(isDirectPrintEnabled('false'), false);
assert.equal(isDirectPrintEnabled('off'), false);
assert.throws(() => isDirectPrintEnabled('quizas'), /true o false/);

console.log('print-config tests: ok');
