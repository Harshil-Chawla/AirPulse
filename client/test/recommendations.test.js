import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRecommendations } from '../src/utils/deploymentRecommendations.js';

test('generateRecommendations creates targeted recommendations based on active hotspots and coverage gaps', () => {
    const stations = [
        { id: 1, name: 'Industrial Fixed', type: 'FIXED', readings: [{ aqi: 240, latitude: 28.6139, longitude: 77.2090, pm25: 140 }] },
        { id: 2, name: 'Mobile Unit Alpha', type: 'MOBILE', readings: [{ aqi: 120, latitude: 28.6250, longitude: 77.2200, pm25: 60 }] },
    ];

    const recs = generateRecommendations(stations);
    assert.ok(recs.length >= 1);
    
    // Check top hotspot recommendation
    const droneRec = recs.find(r => r.unitType === 'DRONE');
    assert.ok(droneRec);
    assert.equal(droneRec.targetName, 'Industrial Fixed');
    assert.equal(droneRec.priority, 'HIGH');
    assert.ok(droneRec.rationale.includes('Industrial Fixed'));
});

test('generateRecommendations suggests corridor assessment when multiple elevated stations exist', () => {
    const stations = [
        { id: 1, name: 'North Station', type: 'FIXED', readings: [{ aqi: 210, latitude: 28.65, longitude: 77.21, pm25: 110 }] },
        { id: 2, name: 'South Station', type: 'MOBILE', readings: [{ aqi: 150, latitude: 28.61, longitude: 77.23, pm25: 75 }] },
    ];

    const recs = generateRecommendations(stations);
    const corridorRec = recs.find(r => r.id.startsWith('rec-corridor'));
    assert.ok(corridorRec);
    assert.equal(corridorRec.unitType, 'DRONE');
    assert.ok(corridorRec.title.includes('Transport Corridor'));
});

test('generateRecommendations returns empty array when no stations are available without fabricating data', () => {
    const recs = generateRecommendations([]);
    assert.deepEqual(recs, []);
});
