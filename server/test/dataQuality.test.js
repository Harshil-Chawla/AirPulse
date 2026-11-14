import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStationReliability } from '../src/analytics/dataQuality.js';

test('evaluateStationReliability: scores healthy, complete station high', () => {
    const station = { id: 1, name: 'Delhi Tech Park' };
    const now = '2026-11-14T12:00:00Z';
    const readings = [
        { aqi: 120, pm25: 60, pm10: 95, no2: 30, so2: 15, co: 0.8, o3: 35, recordedAt: '2026-11-14T11:50:00Z' },
        { aqi: 125, pm25: 62, pm10: 98, no2: 32, so2: 14, co: 0.9, o3: 38, recordedAt: '2026-11-14T11:40:00Z' },
        { aqi: 118, pm25: 58, pm10: 90, no2: 28, so2: 12, co: 0.7, o3: 32, recordedAt: '2026-11-14T11:30:00Z' },
    ];

    const result = evaluateStationReliability(station, readings, { now });
    assert.equal(result.status, 'EVALUATED');
    assert.equal(result.reliabilityTier, 'HIGH');
    assert.ok(result.score >= 90);
    assert.equal(result.metrics.flaggedReadingsCount, 0);
    assert.equal(result.metrics.completenessRate, 100);
    assert.equal(result.metrics.freshnessStatus, 'FRESH');
});

test('evaluateStationReliability: detects negative glitches, missing AQI, and suspicious inversions', () => {
    const station = { id: 2, name: 'Glitchy Station' };
    const now = '2026-11-14T12:00:00Z';
    const readings = [
        { aqi: null, pm25: -999, pm10: 50, recordedAt: '2026-11-14T11:50:00Z' }, // missing AQI & negative glitch
        { aqi: 150, pm25: 120, pm10: 40, recordedAt: '2026-11-14T11:40:00Z' }, // PM2.5 > PM10 inversion
        { aqi: 650, pm25: 30, pm10: 60, recordedAt: '2026-11-14T11:30:00Z' }, // out of bounds AQI > 500
    ];

    const result = evaluateStationReliability(station, readings, { now });
    assert.equal(result.status, 'EVALUATED');
    assert.ok(result.score < 60);
    assert.equal(result.reliabilityTier, 'LOW');
    assert.equal(result.metrics.flaggedReadingsCount, 3);
    assert.ok(result.flags.some(f => f.includes('missing AQI')));
    assert.ok(result.flags.some(f => f.includes('negative reading glitches')));
    assert.ok(result.flags.some(f => f.includes('suspicious values')));
});

test('evaluateStationReliability: penalizes stale data reporting', () => {
    const station = { id: 3, name: 'Stale Station' };
    const now = '2026-11-14T18:00:00Z';
    const readings = [
        { aqi: 100, pm25: 40, pm10: 70, recordedAt: '2026-11-14T12:00:00Z' }, // 6 hours old (expired)
    ];

    const result = evaluateStationReliability(station, readings, { now });
    assert.equal(result.metrics.freshnessStatus, 'EXPIRED');
    assert.ok(result.flags.some(f => f.includes('expired')));
});

test('evaluateStationReliability: handles empty readings safely', () => {
    const result = evaluateStationReliability({ id: 9 }, []);
    assert.equal(result.status, 'NO_DATA');
    assert.equal(result.reliabilityTier, 'UNRATED');
    assert.equal(result.score, 0);
});
