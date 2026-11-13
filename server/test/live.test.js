import { test } from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.AIRPULSE_TEST_URL;
test('live API connects to seeded database and validates history', { skip: !base }, async () => {
    const request = path => fetch(`${base}${path}`, { signal: AbortSignal.timeout(10000) });
    const health = await request('/api/db-health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).success, true);
    const listing = await request('/api/stations');
    assert.equal(listing.status, 200);
    const { stations } = await listing.json();
    assert.ok(stations.length >= 3, 'Seed the dedicated test database first');
    const response = await request(`/api/stations/${stations[0].id}/readings?limit=1`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).readings.length, 1);
    assert.equal((await request('/api/stations/abc/readings')).status, 400);
    assert.equal((await request(`/api/stations/${stations[0].id}/readings?limit=1001`)).status, 400);
    assert.equal((await request('/api/unknown')).status, 404);
});
