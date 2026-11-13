import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizePollutantValue,
    normalizeReading,
    getDataFreshness,
    aggregateReadings
} from '../src/lib/validation.js';

test('normalizePollutantValue filters negative glitches, NaNs and rounds to 1 decimal', () => {
    assert.equal(normalizePollutantValue(null), null);
    assert.equal(normalizePollutantValue(undefined), null);
    assert.equal(normalizePollutantValue(''), null);
    assert.equal(normalizePollutantValue(-999), null, 'sensor error code -999 filtered');
    assert.equal(normalizePollutantValue(-1), null, 'negative sensor drift filtered');
    assert.equal(normalizePollutantValue('NaN'), null);
    assert.equal(normalizePollutantValue('invalid'), null);
    assert.equal(normalizePollutantValue(45.678), 45.7);
    assert.equal(normalizePollutantValue('12.34'), 12.3);
    assert.equal(normalizePollutantValue(0), 0);
});

test('normalizeReading validates payload, clamps bounds and enforces PM2.5 <= PM10 physics', () => {
    // Basic valid reading
    const reading = normalizeReading({
        stationId: '5',
        latitude: 28.6139,
        longitude: 77.2090,
        pm25: 85.4,
        pm10: 120.2,
        aqi: 220,
        source: 'OPENAQ'
    });
    assert.equal(reading.stationId, 5);
    assert.equal(reading.latitude, 28.6139);
    assert.equal(reading.longitude, 77.209);
    assert.equal(reading.pm25, 85.4);
    assert.equal(reading.pm10, 120.2);
    assert.equal(reading.aqi, 220);
    assert.equal(reading.source, 'OPENAQ');
    assert.ok(reading.recordedAt instanceof Date);

    // Physics constraint: PM2.5 > PM10 sensor inversion is corrected
    const inverted = normalizeReading({
        stationId: 1,
        latitude: 28.5,
        longitude: 77.1,
        pm25: 110.0,
        pm10: 60.0
    });
    assert.equal(inverted.pm25, 110.0);
    assert.equal(inverted.pm10, 110.0, 'PM10 was calibrated up to PM2.5');

    // Future timestamp rejection
    assert.throws(() => normalizeReading({
        stationId: 1,
        latitude: 28.5,
        longitude: 77.1,
        recordedAt: new Date(Date.now() + 120000).toISOString()
    }), /future/);

    // Invalid source rejection
    assert.throws(() => normalizeReading({
        stationId: 1,
        latitude: 28.5,
        longitude: 77.1,
        source: 'INVALID_SOURCE'
    }), /Invalid data source/);

    // Invalid latitude rejection
    assert.throws(() => normalizeReading({
        stationId: 1,
        latitude: 95.0,
        longitude: 77.1
    }), /Latitude must be a valid number/);
});

test('getDataFreshness categorizes reading recency correctly', () => {
    const now = new Date('2026-11-14T02:00:00Z');
    
    // Fresh: 10 minutes ago
    const fresh = getDataFreshness(new Date('2026-11-14T01:50:00Z'), now);
    assert.equal(fresh.status, 'fresh');
    assert.equal(fresh.ageMinutes, 10);

    // Stale: 45 minutes ago
    const stale = getDataFreshness(new Date('2026-11-14T01:15:00Z'), now);
    assert.equal(stale.status, 'stale');
    assert.equal(stale.ageMinutes, 45);

    // Expired: 180 minutes ago
    const expired = getDataFreshness(new Date('2026-11-13T23:00:00Z'), now);
    assert.equal(expired.status, 'expired');
    assert.equal(expired.ageMinutes, 180);

    // Null/invalid
    assert.equal(getDataFreshness(null), null);
    assert.equal(getDataFreshness('invalid-date'), null);
});

test('aggregateReadings produces accurate summary metrics and handles empty/partial data', () => {
    // Empty case
    const empty = aggregateReadings([]);
    assert.equal(empty.count, 0);
    assert.equal(empty.summary.aqi, null);
    assert.equal(empty.freshness, null);

    // Multiple readings with some null/missing pollutants
    const readings = [
        {
            recordedAt: '2026-11-14T01:00:00Z',
            aqi: 100,
            pm25: 40.0,
            pm10: 80.0,
            no2: 25.0,
            so2: null,
            co: 1.2,
            o3: 30.0
        },
        {
            recordedAt: '2026-11-14T01:30:00Z',
            aqi: 200,
            pm25: 90.0,
            pm10: 160.0,
            no2: 45.0,
            so2: 15.0,
            co: 2.0,
            o3: null
        }
    ];

    const agg = aggregateReadings(readings, new Date('2026-11-14T01:40:00Z'));
    assert.equal(agg.count, 2);
    assert.equal(agg.timeRange.earliest, '2026-11-14T01:00:00.000Z');
    assert.equal(agg.timeRange.latest, '2026-11-14T01:30:00.000Z');
    assert.equal(agg.freshness.status, 'fresh');
    assert.equal(agg.freshness.ageMinutes, 10);

    // AQI stats
    assert.deepEqual(agg.summary.aqi, { min: 100, max: 200, avg: 150, count: 2 });
    // PM2.5 stats: (40 + 90) / 2 = 65
    assert.deepEqual(agg.summary.pm25, { min: 40.0, max: 90.0, avg: 65, count: 2 });
    // SO2 stats: only 1 reading had SO2
    assert.deepEqual(agg.summary.so2, { min: 15.0, max: 15.0, avg: 15, count: 1 });
});
