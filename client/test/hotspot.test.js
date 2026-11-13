import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectHotspots, getDominantPollutant } from '../src/utils/hotspotDetection.js';

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
