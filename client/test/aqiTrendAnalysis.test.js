import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAQITrend } from '../src/utils/aqiTrendAnalysis.js';

test('analyzeAQITrend: correctly detects improving trend (AQI dropping)', () => {
    const readings = [
        { aqi: 200, recordedAt: '2026-11-14T00:00:00Z' },
        { aqi: 180, recordedAt: '2026-11-14T01:00:00Z' },
        { aqi: 150, recordedAt: '2026-11-14T02:00:00Z' },
        { aqi: 120, recordedAt: '2026-11-14T03:00:00Z' },
    ];

    const result = analyzeAQITrend(readings);
    assert.equal(result.status, 'OPTIMAL');
    assert.equal(result.trend, 'IMPROVING');
    assert.equal(result.direction, 'DOWN');
    assert.equal(result.absoluteChange, -80);
    assert.equal(result.percentageChange, -40);
    assert.equal(result.extrema.max.aqi, 200);
    assert.equal(result.extrema.min.aqi, 120);
    assert.equal(result.summary.average, 162.5);
});

test('analyzeAQITrend: correctly detects deteriorating trend (AQI rising)', () => {
    const readings = [
        { aqi: 100, recordedAt: '2026-11-14T00:00:00Z' },
        { aqi: 130, recordedAt: '2026-11-14T01:00:00Z' },
        { aqi: 170, recordedAt: '2026-11-14T02:00:00Z' },
    ];

    const result = analyzeAQITrend(readings);
    assert.equal(result.trend, 'DETERIORATING');
    assert.equal(result.direction, 'UP');
    assert.equal(result.absoluteChange, 70);
    assert.equal(result.percentageChange, 70);
});

test('analyzeAQITrend: detects stable trend within threshold', () => {
    const readings = [
        { aqi: 150, recordedAt: '2026-11-14T00:00:00Z' },
        { aqi: 152, recordedAt: '2026-11-14T01:00:00Z' },
        { aqi: 149, recordedAt: '2026-11-14T02:00:00Z' },
    ];

    const result = analyzeAQITrend(readings);
    assert.equal(result.trend, 'STABLE');
});

test('analyzeAQITrend: handles invalid timestamps, missing values, and empty arrays', () => {
    assert.equal(analyzeAQITrend([]).status, 'INSUFFICIENT_DATA');
    assert.equal(analyzeAQITrend(null).status, 'INSUFFICIENT_DATA');

    const readingsWithBadData = [
        { aqi: null, recordedAt: '2026-11-14T00:00:00Z' },
        { aqi: 150, recordedAt: 'invalid-date' },
        { aqi: -50, recordedAt: '2026-11-14T01:00:00Z' },
        { aqi: 140, recordedAt: '2026-11-14T02:00:00Z' },
        { aqi: 140, recordedAt: '2026-11-14T03:00:00Z' },
    ];

    const result = analyzeAQITrend(readingsWithBadData);
    assert.equal(result.dataPoints, 2);
    assert.equal(result.status, 'OPTIMAL');
    assert.equal(result.trend, 'STABLE');
});
