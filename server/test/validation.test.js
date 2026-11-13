import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stationId, historyOptions } from '../src/lib/validation.js';
test('IDs reject fractional, negative, overflow and nonnumeric values', () => {
    for (const id of ['1.2', '-1', '0', 'abc', '2147483648', '1e2', '']) assert.throws(() => stationId(id));
    assert.equal(stationId('4'), 4);
});
test('history has bounded defaults and rejects invalid limits', () => {
    assert.equal(historyOptions({}).limit, 200);
    for (const limit of ['0', '1001', 'abc', '2.5', '1e2', ' 5 ', '']) assert.throws(() => historyOptions({ limit }));
    assert.equal(historyOptions({ limit: '1000' }).limit, 1000);
});
test('history validates dates and rejects future or non-string timestamps', () => {
    assert.throws(() => historyOptions({ since: 'invalid' }));
    assert.throws(() => historyOptions({ since: 12345 }));
    assert.throws(() => historyOptions({ since: new Date(Date.now() + 120000).toISOString() }), /future/);
    assert.equal(historyOptions({ since: '2026-11-13T00:00:00Z' }).since.toISOString(), '2026-11-13T00:00:00.000Z');
});
