import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectHotspots, getDominantPollutant, prioritizeHotspots } from '../src/utils/hotspotDetection.js';

test('detectHotspots ranks stations by AQI severity in descending order', () => {
    const stations = [
        { id: 1, name: 'Station A', type: 'FIXED', readings: [{ aqi: 120, latitude: 28.6, longitude: 77.2, pm25: 70, pm10: 80 }] },
        { id: 2, name: 'Station B', type: 'MOBILE', readings: [{ aqi: 310, latitude: 28.7, longitude: 77.3, pm25: 180, pm10: 150 }] },
        { id: 3, name: 'Station C', type: 'DRONE', readings: [{ aqi: 45, latitude: 28.5, longitude: 77.1, pm25: 20, pm10: 40 }] },
    ];

    const hotspots = detectHotspots(stations);
    assert.equal(hotspots.length, 3);
    assert.equal(hotspots[0].id, 2);
    assert.equal(hotspots[0].severity, 'Very Poor');
    assert.equal(hotspots[1].id, 1);
    assert.equal(hotspots[1].severity, 'Moderate');
    assert.equal(hotspots[2].id, 3);
    assert.equal(hotspots[2].severity, 'Good');
});

test('detectHotspots ignores stations with missing or invalid AQI', () => {
    const stations = [
        { id: 1, name: 'Valid', type: 'FIXED', readings: [{ aqi: 250, latitude: 28.6, longitude: 77.2 }] },
        { id: 2, name: 'Missing AQI', type: 'FIXED', readings: [{ aqi: null }] },
        { id: 3, name: 'No Readings', type: 'DRONE', readings: [] },
        { id: 4, name: 'Negative AQI', type: 'MOBILE', readings: [{ aqi: -10 }] },
    ];

    const hotspots = detectHotspots(stations);
    assert.equal(hotspots.length, 1);
    assert.equal(hotspots[0].id, 1);
    assert.equal(hotspots[0].aqi, 250);
});

test('getDominantPollutant identifies the pollutant with highest benchmark ratio', () => {
    const pm25Dominant = { pm25: 120, pm10: 50, no2: 20, so2: 10, co: 0.5, o3: 20 };
    assert.equal(getDominantPollutant(pm25Dominant), 'PM2.5');

    const pm10Dominant = { pm25: 30, pm10: 300, no2: 20, so2: 10, co: 0.5, o3: 20 };
    assert.equal(getDominantPollutant(pm10Dominant), 'PM10');

    assert.equal(getDominantPollutant(null), null);
});

test('prioritizeHotspots distinguishes chronic recurring hotspots from transient spikes', () => {
    const stations = [
        { id: 1, name: 'Chronic Industrial', type: 'FIXED', readings: [{ aqi: 220, recordedAt: '2026-11-14T10:00:00Z' }] },
        { id: 2, name: 'Transient Spike', type: 'MOBILE', readings: [{ aqi: 240, recordedAt: '2026-11-14T10:00:00Z' }] },
    ];

    // Station 1 has chronic high pollution history
    const histories = {
        1: [
            { aqi: 210 }, { aqi: 230 }, { aqi: 195 }, { aqi: 220 },
        ],
        // Station 2 has low background with single transient peak
        2: [
            { aqi: 50 }, { aqi: 60 }, { aqi: 45 }, { aqi: 70 },
        ],
    };

    const prioritized = prioritizeHotspots(stations, histories, { now: '2026-11-14T10:05:00Z' });
    assert.equal(prioritized.length, 2);

    const chronic = prioritized.find(p => p.id === 1);
    const transient = prioritized.find(p => p.id === 2);

    assert.equal(chronic.recurrenceCategory, 'CHRONIC_HOTSPOT');
    assert.equal(transient.recurrenceCategory, 'TRANSIENT_SPIKE');
    // Chronic hotspot should rank higher despite slightly lower current reading
    assert.ok(chronic.priorityScore > transient.priorityScore);
    assert.ok(chronic.explanation.includes('Persistent elevated baseline'));
});

test('prioritizeHotspots downweights stale readings and handles empty collections safely', () => {
    assert.deepEqual(prioritizeHotspots([]), []);
    assert.deepEqual(prioritizeHotspots(null), []);

    const stations = [
        { id: 1, name: 'Fresh', type: 'FIXED', readings: [{ aqi: 200, recordedAt: '2026-11-14T12:00:00Z' }] },
        { id: 2, name: 'Stale', type: 'FIXED', readings: [{ aqi: 200, recordedAt: '2026-11-14T08:00:00Z' }] }, // 4 hours old
    ];

    const results = prioritizeHotspots(stations, {}, { now: '2026-11-14T12:05:00Z' });
    assert.equal(results.length, 2);
    assert.equal(results[0].id, 1, 'Fresh reading should take priority over stale');
    assert.ok(results[0].priorityScore > results[1].priorityScore);
});
