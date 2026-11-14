import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    evaluateCandidateWaypoint,
    computeAdaptiveDeployments,
    VEHICLE_CONSTRAINTS,
} from '../src/utils/adaptiveMonitoringOptimization.js';

test('evaluateCandidateWaypoint computes transparent weighted multi-criteria priority score', () => {
    const station = {
        id: 2,
        name: 'Mobile Van Alpha',
        type: 'MOBILE',
        latitude: 28.62,
        longitude: 77.21,
        readings: [{ aqi: 180, latitude: 28.62, longitude: 77.21, recordedAt: new Date().toISOString() }],
    };

    const allStations = [
        station,
        { id: 1, type: 'FIXED', latitude: 28.61, longitude: 77.20, readings: [{ aqi: 150 }] },
    ];

    const result = evaluateCandidateWaypoint({
        candidateLat: 28.625,
        candidateLon: 28.625, // Note: testing distance computation
        candidateName: 'North Industrial Cluster',
        station,
        allStations,
        estimatedAQI: 250,
        now: Date.now(),
    });

    assert.ok(result.priorityScore >= 0 && result.priorityScore <= 100);
    assert.ok(result.scoreBreakdown.severity > 0);
    assert.ok(result.scoreBreakdown.coverageGap > 0);
    assert.ok(typeof result.rationale === 'string' && result.rationale.length > 0);
});

test('VEHICLE_CONSTRAINTS enforces distinct operational radius for drones vs mobile vans', () => {
    assert.equal(VEHICLE_CONSTRAINTS.DRONE.maxRangeKm, 3.5);
    assert.equal(VEHICLE_CONSTRAINTS.MOBILE.maxRangeKm, 8.0);
    assert.ok(VEHICLE_CONSTRAINTS.DRONE.maxRangeKm < VEHICLE_CONSTRAINTS.MOBILE.maxRangeKm);
});

test('computeAdaptiveDeployments evaluates dynamic assets and ranks candidate destinations', () => {
    const stations = [
        {
            id: 1,
            name: 'Fixed Base',
            type: 'FIXED',
            latitude: 28.6139,
            longitude: 77.2090,
            readings: [{ aqi: 140, latitude: 28.6139, longitude: 77.2090 }],
        },
        {
            id: 2,
            name: 'Mobile Van 1',
            type: 'MOBILE',
            latitude: 28.6200,
            longitude: 77.2150,
            readings: [{ aqi: 220, latitude: 28.6200, longitude: 77.2150 }],
        },
        {
            id: 3,
            name: 'Drone UAV 1',
            type: 'DRONE',
            latitude: 28.6300,
            longitude: 77.2200,
            readings: [{ aqi: 160, latitude: 28.6300, longitude: 77.2200 }],
        },
    ];

    const deployments = computeAdaptiveDeployments(stations);
    assert.equal(deployments.length, 2); // Only Mobile and Drone
    assert.ok(deployments[0].optimalWaypoint.priorityScore > 0);
    assert.ok(deployments[0].allWaypoints.length >= 1);
});

test('computeAdaptiveDeployments safely returns empty array when only fixed stations are present', () => {
    const fixedOnly = [
        { id: 1, name: 'Fixed A', type: 'FIXED', latitude: 28.6, longitude: 77.2, readings: [{ aqi: 100 }] },
    ];
    assert.deepEqual(computeAdaptiveDeployments(fixedOnly), []);
    assert.deepEqual(computeAdaptiveDeployments([]), []);
});
