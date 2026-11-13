import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePollutantIntelligence } from '../src/utils/pollutantIntelligence.js';

test('analyzePollutantIntelligence aggregates dominant pollutants and identifies primary driver', () => {
    const stations = [
        { id: 1, name: 'Station 1', readings: [{ pm25: 120, pm10: 140, aqi: 180 }] }, // PM2.5 dominant (120/60 = 2.0 vs 140/100 = 1.4)
        { id: 2, name: 'Station 2', readings: [{ pm25: 110, pm10: 130, aqi: 170 }] }, // PM2.5 dominant
        { id: 3, name: 'Station 3', readings: [{ pm25: 30, pm10: 250, aqi: 150 }] },  // PM10 dominant (250/100 = 2.5)
    ];

    const result = analyzePollutantIntelligence(stations);
    assert.equal(result.primaryDriver, 'PM2.5');
    assert.equal(result.dominantBreakdown['PM2.5'], 2);
    assert.equal(result.dominantBreakdown['PM10'], 1);
    assert.equal(result.driverPercentage, 67);
});

test('analyzePollutantIntelligence diagnoses PM fine/coarse particulate ratios', () => {
    // High fine fraction (combustion)
    const fineStations = [
        { id: 1, readings: [{ pm25: 80, pm10: 100 }] }, // ratio = 0.8
    ];
    const fineResult = analyzePollutantIntelligence(fineStations);
    assert.equal(fineResult.pmRatio, 0.8);
    assert.ok(fineResult.pmRatioDiagnosis.includes('Fine particle dominance'));

    // High coarse fraction (dust)
    const dustStations = [
        { id: 2, readings: [{ pm25: 40, pm10: 100 }] }, // ratio = 0.4
    ];
    const dustResult = analyzePollutantIntelligence(dustStations);
    assert.equal(dustResult.pmRatio, 0.4);
    assert.ok(dustResult.pmRatioDiagnosis.includes('Coarse dust dominance'));
});

test('analyzePollutantIntelligence handles empty stations and missing readings cleanly', () => {
    const emptyResult = analyzePollutantIntelligence([]);
    assert.equal(emptyResult.primaryDriver, 'Unavailable');
    assert.equal(emptyResult.pmRatio, null);

    const noReadingResult = analyzePollutantIntelligence([{ id: 1, readings: [] }]);
    assert.equal(noReadingResult.totalReadings, 0);
});
