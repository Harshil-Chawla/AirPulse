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
