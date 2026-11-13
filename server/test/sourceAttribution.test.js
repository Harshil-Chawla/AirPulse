import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    SOURCE_CATEGORIES,
    attributeReading,
    attributeStation,
    attributeNetwork,
} from '../src/analytics/sourceAttribution.js';

test('attributeReading: handles null, empty, or single-pollutant data gracefully', () => {
    const res1 = attributeReading(null);
    assert.equal(res1.primarySource, 'INSUFFICIENT_DATA');
    assert.equal(res1.status, 'INCONCLUSIVE');
    assert.equal(res1.confidence, 0);

    const res2 = attributeReading({});
    assert.equal(res2.primarySource, 'INSUFFICIENT_DATA');

    // Only 1 pollutant without AQI
    const res3 = attributeReading({ pm25: 50 });
    assert.equal(res3.primarySource, 'INSUFFICIENT_DATA');
    assert.ok(res3.evidence.length > 0);
    assert.ok(res3.limitations.length > 0);
});

test('attributeReading: accurately attributes vehicular traffic signature', () => {
    // High NO2, high CO, fine PM dominance (PM2.5/PM10 = 0.75), morning rush hour (08:30)
    const trafficReading = {
        pm25: 75,
        pm10: 100,
        no2: 85,
        so2: 12,
        co: 1.8,
        o3: 20,
        aqi: 180,
        recordedAt: '2026-11-14T08:30:00',
    };

    const result = attributeReading(trafficReading);
    assert.equal(result.primarySource, 'VEHICULAR_TRAFFIC');
    assert.ok(['SUPPORTED', 'POSSIBLE'].includes(result.status));
    assert.ok(result.confidence >= 0.60);
    assert.equal(result.diagnosticRatios.pmRatio, 0.75);
    assert.ok(result.evidence.some(e => e.includes('NO2')));
    assert.ok(result.evidence.some(e => e.includes('traffic')));
});

test('attributeReading: accurately attributes construction and road dust signature', () => {
    // Coarse dust: Low PM2.5/PM10 ratio (0.33), elevated PM10 (240), low gaseous pollutants
    const constructionReading = {
        pm25: 80,
        pm10: 240,
        no2: 20,
        so2: 8,
        co: 0.4,
        o3: 35,
        aqi: 210,
        recordedAt: '2026-11-14T14:00:00',
    };

    const result = attributeReading(constructionReading);
    assert.equal(result.primarySource, 'CONSTRUCTION_DUST');
    assert.equal(result.status, 'SUPPORTED');
    assert.ok(result.confidence >= 0.70);
    assert.equal(result.diagnosticRatios.pmRatio, 0.33);
    assert.ok(result.evidence.some(e => e.includes('Coarse particulate dominance') || e.includes('PM10')));
});

test('attributeReading: accurately attributes industrial & fossil fuel combustion signature', () => {
    // Elevated SO2 (65), high SO2/NO2 ratio (1.08), high PM2.5 (110)
    const industrialReading = {
        pm25: 110,
        pm10: 160,
        no2: 60,
        so2: 65,
        co: 1.6,
        o3: 25,
        aqi: 280,
        recordedAt: '2026-11-14T23:00:00',
    };

    const result = attributeReading(industrialReading);
    assert.equal(result.primarySource, 'INDUSTRIAL_COMBUSTION');
    assert.equal(result.status, 'SUPPORTED');
    assert.ok(result.confidence >= 0.70);
    assert.ok(result.evidence.some(e => e.includes('SO2')));
});

test('attributeReading: accurately attributes photochemical smog & ozone formation', () => {
    // High O3 (95), midday solar hours (13:00), moderate NO2
    const ozoneReading = {
        pm25: 35,
        pm10: 60,
        no2: 30,
        so2: 10,
        co: 0.5,
        o3: 95,
        aqi: 155,
        recordedAt: '2026-11-14T13:30:00',
    };

    const result = attributeReading(ozoneReading);
    assert.equal(result.primarySource, 'PHOTOCHEMICAL_SMOG');
    assert.ok(result.evidence.some(e => e.includes('Ozone') || e.includes('solar')));
});

test('attributeReading: attributes biomass / agricultural burning signature', () => {
    // Fine PM ratio (0.83), heavy PM2.5 (150), high CO (2.2), low SO2 (8)
    const biomassReading = {
        pm25: 150,
        pm10: 180,
        no2: 35,
        so2: 8,
        co: 2.2,
        o3: 15,
        aqi: 320,
        recordedAt: '2026-11-14T20:00:00',
    };

    const result = attributeReading(biomassReading);
    assert.equal(result.primarySource, 'BIOMASS_BURNING');
    assert.equal(result.status, 'SUPPORTED');
    assert.ok(result.evidence.some(e => e.includes('biomass') || e.includes('fine particulate')));
});

test('attributeReading: classifies low-moderate baseline as mixed urban background', () => {
    const cleanReading = {
        pm25: 25,
        pm10: 50,
        no2: 20,
        so2: 8,
        co: 0.5,
        o3: 30,
        aqi: 65,
        recordedAt: '2026-11-14T11:00:00',
    };

    const result = attributeReading(cleanReading);
    assert.equal(result.primarySource, 'URBAN_BACKGROUND');
    assert.ok(result.evidence.some(e => e.includes('background') || e.includes('Sub-acute')));
});

test('attributeStation: computes historical temporal consistency rate', () => {
    const station = {
        id: 101,
        name: 'Industrial Zone Station',
        type: 'FIXED',
        readings: [{
            pm25: 110, pm10: 160, no2: 60, so2: 65, co: 1.5, aqi: 270,
        }],
    };

    const history = [
        { pm25: 110, pm10: 160, no2: 60, so2: 65, co: 1.5, aqi: 270 },
        { pm25: 105, pm10: 155, no2: 58, so2: 62, co: 1.4, aqi: 265 },
        { pm25: 115, pm10: 170, no2: 64, so2: 70, co: 1.6, aqi: 280 },
        { pm25: 20, pm10: 40, no2: 15, so2: 5, co: 0.3, aqi: 45 }, // temporary lull
    ];

    const result = attributeStation(station, history);
    assert.equal(result.stationId, 101);
    assert.equal(result.attribution.primarySource, 'INDUSTRIAL_COMBUSTION');
    assert.ok(result.temporalConsistency !== null);
    assert.equal(result.temporalConsistency.isPersistent, true);
    assert.ok(result.temporalConsistency.consistencyRate >= 70);
});

test('attributeNetwork: summarizes network distribution and regional driver', () => {
    const stations = [
        {
            id: 1, name: 'Ring Road', type: 'FIXED',
            readings: [{ pm25: 80, pm10: 100, no2: 85, co: 1.8, so2: 10, aqi: 180, recordedAt: '2026-11-14T08:30:00' }],
        },
        {
            id: 2, name: 'Connaught Place', type: 'FIXED',
            readings: [{ pm25: 75, pm10: 95, no2: 80, co: 1.7, so2: 12, aqi: 175, recordedAt: '2026-11-14T08:30:00' }],
        },
        {
            id: 3, name: 'Okhla Industrial', type: 'FIXED',
            readings: [{ pm25: 120, pm10: 170, no2: 55, so2: 70, co: 1.5, aqi: 285 }],
        },
    ];

    const net = attributeNetwork(stations);
    assert.equal(net.totalStations, 3);
    assert.equal(net.primaryRegionalDriver, 'VEHICULAR_TRAFFIC');
    assert.equal(net.sourceDistribution.VEHICULAR_TRAFFIC, 2);
    assert.equal(net.sourceDistribution.INDUSTRIAL_COMBUSTION, 1);
});
