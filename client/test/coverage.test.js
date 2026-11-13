import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCoverage } from '../src/utils/coverageAnalysis.js';

test('analyzeCoverage correctly identifies coverage gaps and computes dynamic coverage ratio', () => {
    const stations = [
        { id: 1, name: 'Fixed Station A', type: 'FIXED', readings: [{ aqi: 180, latitude: 28.6139, longitude: 77.2090 }] },
        { id: 2, name: 'Mobile Station B', type: 'MOBILE', readings: [{ aqi: 160, latitude: 28.6200, longitude: 77.2150 }] },
        { id: 3, name: 'Drone Station C', type: 'DRONE', readings: [{ aqi: 120, latitude: 28.6300, longitude: 77.2200 }] },
    ];

    const result = analyzeCoverage(stations);
    assert.equal(result.totalStations, 3);
    // 2 out of 3 stations are mobile/drone = 67%
    assert.equal(result.coverageScore, 67);
    assert.ok(result.activeSectors.length > 0);
    assert.ok(result.gapCount >= 0);
});

test('analyzeCoverage flags fixed-only sectors with high AQI as High priority gaps', () => {
    const stations = [
        { id: 1, name: 'High Pollution Fixed', type: 'FIXED', readings: [{ aqi: 280, latitude: 28.61, longitude: 77.21 }] },
    ];

    const result = analyzeCoverage(stations);
    assert.equal(result.totalStations, 1);
    assert.equal(result.coverageScore, 0); // 0% dynamic
    assert.equal(result.coverageGaps.length, 1);
    assert.equal(result.coverageGaps[0].priority, 'HIGH');
    assert.ok(result.coverageGaps[0].gapReason.includes('High pollution reported with zero mobile/drone verification'));
});

test('analyzeCoverage handles empty and unlocated station arrays safely', () => {
    const emptyResult = analyzeCoverage([]);
    assert.equal(emptyResult.totalStations, 0);
    assert.equal(emptyResult.coverageScore, 0);
    assert.equal(emptyResult.coverageGaps.length, 0);

    const unlocatedResult = analyzeCoverage([
        { id: 1, name: 'Station Without Coords', type: 'FIXED', readings: [{ aqi: 100, latitude: null, longitude: null }] }
    ]);
    assert.equal(unlocatedResult.totalStations, 0);
});
