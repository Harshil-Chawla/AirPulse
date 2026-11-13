import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateDistanceKm,
    computeTemporalStats,
    detectSpatiotemporalAnomalies,
} from '../src/utils/anomalyDetection.js';

test('calculateDistanceKm computes accurate Haversine distance between coordinates', () => {
    // Distance between Connaught Place (28.6315, 77.2167) and India Gate (28.6129, 77.2295) is approx 2.4 km
    const dist = calculateDistanceKm(28.6315, 77.2167, 28.6129, 77.2295);
    assert.ok(dist >= 2.0 && dist <= 2.8);
    assert.equal(calculateDistanceKm(28.6, 77.2, 28.6, 77.2), 0);
});

test('computeTemporalStats correctly computes historical mean, stdDev and handles invalid readings', () => {
    const readings = [
        { aqi: 100, recordedAt: '2026-11-14T02:00:00Z' },
        { aqi: 120, recordedAt: '2026-11-14T01:50:00Z' },
        { aqi: 110, recordedAt: '2026-11-14T01:40:00Z' },
        { aqi: null, recordedAt: '2026-11-14T01:30:00Z' }, // Invalid, should be filtered
    ];

    const stats = computeTemporalStats(readings);
    assert.equal(stats.count, 3);
    assert.equal(stats.mean, 110);
    assert.equal(stats.latest.aqi, 100);
    assert.ok(stats.stdDev > 0);

    const emptyStats = computeTemporalStats([]);
    assert.equal(emptyStats.count, 0);
    assert.equal(emptyStats.mean, null);
});

test('detectSpatiotemporalAnomalies detects spatial outliers when station diverges from neighbors', () => {
    const now = Date.parse('2026-11-14T02:00:00Z');
    const stations = [
        // Outlier station: 260 AQI
        {
            id: 1,
            name: 'Industrial Spot',
            type: 'FIXED',
            latitude: 28.6139,
            longitude: 77.2090,
            readings: [{ aqi: 260, latitude: 28.6139, longitude: 77.2090, recordedAt: new Date(now).toISOString() }],
        },
        // Neighboring station A (1 km away): 120 AQI
        {
            id: 2,
            name: 'Park Station',
            type: 'MOBILE',
            latitude: 28.6200,
            longitude: 77.2150,
            readings: [{ aqi: 120, latitude: 28.6200, longitude: 77.2150, recordedAt: new Date(now).toISOString() }],
        },
        // Neighboring station B (2 km away): 130 AQI
        {
            id: 3,
            name: 'Residential Node',
            type: 'DRONE',
            latitude: 28.6300,
            longitude: 77.2200,
            readings: [{ aqi: 130, latitude: 28.6300, longitude: 77.2200, recordedAt: new Date(now).toISOString() }],
        },
    ];

    const result = detectSpatiotemporalAnomalies(stations, {}, now);
    assert.ok(result.activeCount >= 1);
    const outlier = result.anomalies.find(a => a.stationId === 1);
    assert.ok(outlier);
    assert.equal(outlier.stationName, 'Industrial Spot');
    assert.ok(outlier.spatialDiff >= 35);
});

test('detectSpatiotemporalAnomalies skips stale data (> 2 hours old)', () => {
    const now = Date.parse('2026-11-14T02:00:00Z');
    const staleTime = new Date(now - 3 * 3600000).toISOString(); // 3 hours ago
    const stations = [
        {
            id: 1,
            name: 'Stale Sensor',
            type: 'FIXED',
            latitude: 28.6,
            longitude: 77.2,
            readings: [{ aqi: 450, latitude: 28.6, longitude: 77.2, recordedAt: staleTime }],
        },
    ];

    const result = detectSpatiotemporalAnomalies(stations, {}, now);
    assert.equal(result.activeCount, 0);
});
