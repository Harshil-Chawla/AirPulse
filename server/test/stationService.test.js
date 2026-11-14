import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
let station, baseline, query, findUniqueCalls = 0;
const prisma = {
    station: {
        findUnique: async () => {
            findUniqueCalls++;
            return station;
        },
    },
    reading: {
        findFirst: async () => baseline,
        findMany: async args => { query = args; return []; },
        create: async ({ data }) => data,
    },
};
globalThis.airpulseTestPrisma = prisma;
const source = (await readFile(new URL('../src/services/stationService.js', import.meta.url), 'utf8'))
    .replace('import { prisma } from "../lib/prisma.js";', 'const prisma = globalThis.airpulseTestPrisma;');
const service = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
delete globalThis.airpulseTestPrisma;
test('simulations use the original baseline and preserve missing pollutants', async () => {
    for (const type of ['MOBILE', 'DRONE']) {
        station = { id: 2, type, latitude: 28, longitude: 77, readings: [{ latitude: 28, longitude: 77, aqi: 490 }] };
        baseline = { aqi: 100, pm25: 80 };
        const result = await service.simulateMobileMovement(2, type);
        assert.equal(result.source, 'SIMULATED');
        assert.ok(result.aqi >= 95 && result.aqi <= 105);
        assert.ok(result.pm25 >= 76 && result.pm25 <= 84);
        assert.equal(result.co, null);
    }
});
test('missing AQI remains missing and coordinate boundaries stay valid', async () => {
    station = { id: 1, type: 'DRONE', latitude: 90, longitude: 180, readings: [] };
    baseline = null;
    const row = await service.simulateDroneMovement(1);
    assert.equal(row.aqi, null);
    assert.ok(row.latitude <= 90 && row.latitude >= -90);
    assert.ok(row.longitude < 180 && row.longitude >= -180);
});
test('fixed and missing stations reject simulation', async () => {
    station = null;
    await assert.rejects(service.simulateMobileMovement(1), /Station not found/);
    station = { type: 'FIXED' };
    await assert.rejects(service.simulateDroneMovement(1), /Station type/);
});
test('history filters by station, start time and count', async () => {
    if (service.clearStationCache) service.clearStationCache();
    station = { id: 1 };
    const since = new Date('2026-11-13');
    await service.getStationReadings(1, { limit: 10, since });
    assert.equal(query.take, 10);
    assert.deepEqual(query.where, { stationId: 1, recordedAt: { gte: since } });
    station = null;
    if (service.clearStationCache) service.clearStationCache();
    await assert.rejects(service.getStationReadings(99), /Station not found/);
});
test('performance optimization: station lookup cache eliminates redundant DB round trips', async () => {
    if (service.clearStationCache) service.clearStationCache();
    station = { id: 42 };
    findUniqueCalls = 0;

    await service.getStationReadings(42, { limit: 5 });
    assert.equal(findUniqueCalls, 1);

    // Second call within TTL should reuse cache and not invoke findUnique again
    await service.getStationReadings(42, { limit: 10 });
    assert.equal(findUniqueCalls, 1, 'Subsequent reading request reused station cache');

    // Also supports time-bracket queries (since & until) efficiently
    const until = new Date('2026-11-14');
    await service.getStationReadings(42, { limit: 15, until });
    assert.deepEqual(query.where.recordedAt, { lte: until });
});
