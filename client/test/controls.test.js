import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterStations } from '../src/utils/stationFilters.js';
test('station search combines city and type without changing source order', () => {
    const rows = [{ id: 1, name: 'Z', city: 'Delhi', type: 'MOBILE', readings: [{ aqi: null }] }, { id: 2, name: 'A', city: 'Delhi', type: 'FIXED', readings: [{ aqi: 0 }] }];
    assert.equal(filterStations(rows, { search: ' DELHI ', type: 'MOBILE' }).length, 1);
    assert.equal(filterStations(rows, { sort: 'aqi' })[0].id, 2);
    assert.equal(rows[0].id, 1);
    assert.equal(filterStations(rows, { search: 'Mumbai' }).length, 0);
});

import { historyInWindow } from '../src/utils/historyWindow.js';
test('history windows exclude future and invalid dates and include boundary', () => {
    const now = Date.parse('2026-11-14T12:00:00Z');
    const rows = ['11:00:00', '10:59:59', '12:00:01'].map(time => ({ recordedAt: `2026-11-14T${time}Z` }));
    assert.equal(historyInWindow([...rows, { recordedAt: 'bad' }], '1', now).length, 1);
    assert.equal(historyInWindow(rows, 'all', now), rows);
});

import { stationPosition } from '../src/utils/mapPositions.js';
test('map focus prefers latest location and rejects invalid coordinates', () => {
    assert.deepEqual(stationPosition({ latitude: 28, longitude: 77, readings: [{ latitude: 0, longitude: 0 }] }), [0, 0]);
    assert.equal(stationPosition({ latitude: 91, longitude: 77 }), null);
    assert.equal(stationPosition(null), null);
});

import { snapshotCSV } from '../src/utils/exportSnapshot.js';
test('snapshot retains identity, zero values and missing-data columns safely', () => {
    const csv = snapshotCSV([{ id: 7, name: '=formula', city: 'New, Delhi', type: 'MOBILE', latitude: 0, longitude: 0 }]);
    assert.ok(csv.includes('"7"'));
    assert.ok(csv.includes('"New, Delhi"'));
    assert.ok(csv.includes('"\' =formula"'));
    assert.ok(csv.includes('"0"'));
    assert.equal(snapshotCSV([]).split('\r\n').length, 1);
});
