import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAreaSummary } from '../src/utils/areaSummary.js';
import { readingsToCSV } from '../src/utils/exportReadings.js';
import { createDemoStore } from '../src/services/demoData.js';
const now = Date.parse('2026-11-13T10:00:00Z');
const station = (aqi, age = 0) => ({ name: 'Station', readings: [{ aqi, latitude: 28.61, longitude: 77.21, recordedAt: new Date(now - age).toISOString() }] });
test('area summary excludes stale, future and missing readings', () => {
    const areas = getAreaSummary([station(100), station(200), station(500, 3600001), station(null), station(500, -120000)], now);
    assert.equal(areas.length, 1);
    assert.equal(areas[0].count, 2);
    assert.equal(areas[0].average, 150);
    assert.equal(areas[0].spread, 100);
    assert.deepEqual(getAreaSummary([], now), []);
});
test('CSV keeps zeros, escapes quotes and neutralizes formulas', () => {
    const csv = readingsToCSV([{ aqi: 0, source: '=SUM(1,2)"' }]);
    assert.ok(csv.includes('"0"'));
    assert.ok(csv.includes('"\' =SUM(1,2)"""'));
    assert.equal(readingsToCSV([]).split('\r\n').length, 1);
});
test('demo movement affects only the requested station and returns copies', async () => {
    const store = createDemoStore();
    const before = await store.stations();
    await store.move(2, 'MOBILE');
    const after = await store.stations();
    assert.equal(before[0].readings[0].latitude, after[0].readings[0].latitude);
    assert.notEqual(before[1].readings[0].latitude, after[1].readings[0].latitude);
    after[1].name = 'mutated';
    assert.notEqual((await store.stations())[1].name, 'mutated');
    await assert.rejects(store.move(1, 'MOBILE'));
});
test('demo history is bounded and a fresh store resets changes', async () => {
    const store = createDemoStore();
    for (let i = 0; i < 220; i++) await store.move(3, 'DRONE');
    assert.equal((await store.readings(3)).length, 200);
    assert.equal((await createDemoStore().readings(3)).length, 12);
});
test('demo movement maintains coordinate bounds across repeated drone movements', async () => {
    const store = createDemoStore();
    for (let i = 0; i < 50; i++) await store.move(3, 'DRONE');
    const readings = await store.readings(3);
    for (const r of readings) {
        assert.ok(r.latitude >= -90 && r.latitude <= 90);
        assert.ok(r.longitude >= -180 && r.longitude < 180);
    }
});
