import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    sanitizeHistory,
    fitHoltModel,
    computeSpatialDrift,
    generateForecast,
    evaluateModelPerformance,
} from '../src/analytics/spatiotemporalForecaster.js';

test('sanitizeHistory: filters invalid readings and ensures strict chronological order', () => {
    const raw = [
        { aqi: 150, recordedAt: '2026-11-14T03:00:00Z' },
        { aqi: -999, recordedAt: '2026-11-14T02:00:00Z' }, // negative
        { aqi: null, recordedAt: '2026-11-14T01:30:00Z' }, // null
        { aqi: 120, recordedAt: '2026-11-14T01:00:00Z' },
        { aqi: 'NaN', recordedAt: '2026-11-14T00:00:00Z' }, // NaN
        { aqi: 135, recordedAt: '2026-11-14T02:00:00Z' },
    ];

    const clean = sanitizeHistory(raw, 'aqi');
    assert.equal(clean.length, 3);
    assert.equal(clean[0].val, 120);
    assert.equal(clean[1].val, 135);
    assert.equal(clean[2].val, 150);
    assert.ok(clean[0].timestamp < clean[1].timestamp);
    assert.ok(clean[1].timestamp < clean[2].timestamp);

    assert.deepEqual(sanitizeHistory([]), []);
    assert.deepEqual(sanitizeHistory(null), []);
});

test('fitHoltModel: correctly identifies rising and falling trends', () => {
    const baseTime = 1731550000000;
    // Rising series: 100, 110, 120, 130 (+10 every hour)
    const rising = [
        { val: 100, timestamp: baseTime },
        { val: 110, timestamp: baseTime + 3600000 },
        { val: 120, timestamp: baseTime + 7200000 },
        { val: 130, timestamp: baseTime + 10800000 },
    ];

    const modelRising = fitHoltModel(rising);
    assert.ok(modelRising.trendPerHour > 5, 'Rising series should produce positive trendPerHour');
    assert.ok(modelRising.level >= 125, 'Level should track current top observation');

    // Falling series: 200, 180, 160, 140 (-20 every hour)
    const falling = [
        { val: 200, timestamp: baseTime },
        { val: 180, timestamp: baseTime + 3600000 },
        { val: 160, timestamp: baseTime + 7200000 },
        { val: 140, timestamp: baseTime + 10800000 },
    ];

    const modelFalling = fitHoltModel(falling);
    assert.ok(modelFalling.trendPerHour < -10, 'Falling series should produce negative trendPerHour');
    assert.ok(modelFalling.level <= 150, 'Level should track declining observation');
});

test('computeSpatialDrift: aggregates neighbor momentum with inverse distance weighting', () => {
    const baseTime = 1731550000000;
    const targetLat = 28.6139;
    const targetLon = 77.2090;

    // Neighbor 1: 5 km away, strong rising trend
    const neighborNear = {
        id: 2,
        latitude: 28.65,
        longitude: 77.22,
        readings: [
            { aqi: 100, recordedAt: new Date(baseTime).toISOString() },
            { aqi: 120, recordedAt: new Date(baseTime + 3600000).toISOString() },
            { aqi: 140, recordedAt: new Date(baseTime + 7200000).toISOString() },
        ],
    };

    // Neighbor 2: 80 km away (beyond 25 km threshold, should be ignored)
    const neighborFar = {
        id: 3,
        latitude: 29.5,
        longitude: 77.8,
        readings: [
            { aqi: 200, recordedAt: new Date(baseTime).toISOString() },
            { aqi: 100, recordedAt: new Date(baseTime + 3600000).toISOString() },
        ],
    };

    const drift = computeSpatialDrift(targetLat, targetLon, [neighborNear, neighborFar]);
    assert.equal(drift.neighborCount, 1);
    assert.ok(drift.spatialTrendPerHour > 0, 'Near neighbor should impart positive momentum');
});

test('generateForecast: produces bounded predictions, widening uncertainty, and decaying confidence', () => {
    const baseTime = 1731550000000;
    const history = [
        { aqi: 120, recordedAt: new Date(baseTime).toISOString() },
        { aqi: 130, recordedAt: new Date(baseTime + 3600000).toISOString() },
        { aqi: 142, recordedAt: new Date(baseTime + 7200000).toISOString() },
        { aqi: 155, recordedAt: new Date(baseTime + 10800000).toISOString() },
        { aqi: 168, recordedAt: new Date(baseTime + 14400000).toISOString() },
    ];

    const result = generateForecast(history, { horizonsHours: [1, 3, 6, 12, 24], metric: 'aqi' });
    assert.equal(result.status, 'OPTIMAL');
    assert.equal(result.forecasts.length, 5);

    // Verify 1h vs 24h
    const f1h = result.forecasts[0];
    const f24h = result.forecasts[4];

    // Predictions must respect physical bounds [0, 500]
    for (const f of result.forecasts) {
        assert.ok(f.predictedValue >= 0 && f.predictedValue <= 500);
        assert.ok(f.lowerBound <= f.predictedValue);
        assert.ok(f.upperBound >= f.predictedValue);
    }

    // Uncertainty interval (upper - lower) should widen over time
    const spread1h = f1h.upperBound - f1h.lowerBound;
    const spread24h = f24h.upperBound - f24h.lowerBound;
    assert.ok(spread24h > spread1h, `Spread at 24h (${spread24h}) must be wider than at 1h (${spread1h})`);

    // Confidence should decay over time
    assert.ok(f1h.confidence > f24h.confidence, 'Confidence should decay with horizon length');
});

test('generateForecast: handles limited history gracefully with persistence baseline', () => {
    const history = [
        { aqi: 180, recordedAt: '2026-11-14T03:00:00Z' },
    ];

    const res = generateForecast(history);
    assert.equal(res.status, 'LIMITED_HISTORY');
    assert.equal(res.forecasts.length, 5);
    assert.equal(res.forecasts[0].predictedValue, 180);
    assert.equal(res.forecasts[0].method, 'PERSISTENCE_BASELINE');
});

test('generateForecast: handles empty input gracefully', () => {
    const res = generateForecast([]);
    assert.equal(res.status, 'INSUFFICIENT_DATA');
    assert.deepEqual(res.forecasts, []);
});

test('evaluateModelPerformance: computes out-of-sample metrics without data leakage', () => {
    const baseTime = 1731550000000;
    // Consistent gradual progression
    const series = [
        { val: 100, timestamp: baseTime },
        { val: 105, timestamp: baseTime + 3600000 },
        { val: 112, timestamp: baseTime + 7200000 },
        { val: 118, timestamp: baseTime + 10800000 },
        { val: 125, timestamp: baseTime + 14400000 },
        { val: 132, timestamp: baseTime + 18000000 },
    ];

    const evalRes = evaluateModelPerformance(series);
    assert.ok(evalRes.evaluableObservations >= 3);
    assert.ok(Number.isFinite(evalRes.mae));
    assert.ok(Number.isFinite(evalRes.rmse));
    assert.ok(Number.isFinite(evalRes.baselineRmse));
    assert.ok(typeof evalRes.beatsPersistence === 'boolean');
});
