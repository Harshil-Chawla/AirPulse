import { test } from "node:test";
import assert from "node:assert/strict";
import {
    haversineKm,
    freshnessWeight,
    inverseDistanceWeight,
    buildFusionCandidates,
    filterOutliers,
    fuseStationReadings,
    fuseNetworkReadings,
} from "../src/analytics/sensorFusion.js";

// ─── Utility tests ─────────────────────────────────────────────────────────

test("haversineKm: same point → 0 km", () => {
    assert.equal(haversineKm(28.6, 77.2, 28.6, 77.2), 0);
});

test("haversineKm: Delhi to Mumbai ≈ 1148 km", () => {
    const dist = haversineKm(28.6139, 77.2090, 19.0760, 72.8777);
    assert.ok(dist > 1100 && dist < 1200, `Expected ~1148 km, got ${dist.toFixed(1)}`);
});

test("freshnessWeight: age 0 → 1.0, age = half-life → ~0.5, stale → 0", () => {
    const w0 = freshnessWeight(0);
    assert.ok(Math.abs(w0 - 1.0) < 0.001, "Age 0 should give weight ~1.0");

    const w30 = freshnessWeight(30); // half-life is 30 min
    assert.ok(Math.abs(w30 - 0.5) < 0.01, `Half-life weight should be ~0.5, got ${w30}`);

    const wStale = freshnessWeight(121);
    assert.equal(wStale, 0, "Past stale cutoff should return 0");

    assert.equal(freshnessWeight(-5), 0, "Negative age should return 0");
});

test("inverseDistanceWeight: shorter distance → higher weight", () => {
    assert.ok(inverseDistanceWeight(1) > inverseDistanceWeight(5));
    assert.ok(inverseDistanceWeight(5) > inverseDistanceWeight(10));
    // co-located (epsilon) should be very high but finite
    const w = inverseDistanceWeight(0);
    assert.ok(Number.isFinite(w) && w > 1000);
});

// ─── buildFusionCandidates tests ───────────────────────────────────────────

function makeStation(id, lat, lon, aqi, ageMinutes = 5, pollutants = {}) {
    const recordedAt = new Date(Date.now() - ageMinutes * 60000).toISOString();
    return {
        id,
        name: `Station ${id}`,
        latitude: lat,
        longitude: lon,
        readings: [{
            aqi,
            latitude: lat,
            longitude: lon,
            recordedAt,
            pm25: pollutants.pm25 ?? 50,
            pm10: pollutants.pm10 ?? 80,
            no2: pollutants.no2 ?? null,
            so2: null,
            co: null,
            o3: null,
        }],
    };
}

test("buildFusionCandidates: excludes stations beyond radius and stale readings", () => {
    const refLat = 28.6, refLon = 77.2;
    const now = new Date();

    const nearFresh = makeStation(1, 28.65, 77.25, 120, 10);
    const nearStale = makeStation(2, 28.62, 77.22, 150, 125); // > STALE_CUTOFF
    const farFresh = makeStation(3, 29.5, 78.5, 200, 10);    // >> 25 km away
    const noReading = { id: 4, latitude: 28.6, longitude: 77.2, readings: [] };

    const candidates = buildFusionCandidates([nearFresh, nearStale, farFresh, noReading], refLat, refLon, now);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].stationId, 1);
});

test("buildFusionCandidates: weight is higher for closer, fresher stations", () => {
    const refLat = 28.6, refLon = 77.2;
    const now = new Date();

    const closeRecent = makeStation(1, 28.605, 77.205, 100, 5);  // 0.7 km, 5 min old
    const farOld = makeStation(2, 28.70, 77.30, 110, 50);        // ~12 km, 50 min old

    const candidates = buildFusionCandidates([closeRecent, farOld], refLat, refLon, now);
    assert.equal(candidates.length, 2);
    const close = candidates.find(c => c.stationId === 1);
    const far = candidates.find(c => c.stationId === 2);
    assert.ok(close.baseWeight > far.baseWeight, "Closer+fresher should have higher weight");
});

// ─── filterOutliers tests ──────────────────────────────────────────────────

test("filterOutliers: removes extreme outliers but retains cluster", () => {
    const refLat = 28.6, refLon = 77.2;
    const now = new Date();
    // Tight cluster around AQI 100-110; station 5 is far outside the distribution
    // mean≈156, stdDev≈152, 500 → (500-156)/152 ≈ 2.26σ — just at boundary.
    // Use a really dense cluster so the extreme reading is clearly > 3σ.
    const normal1 = makeStation(1, 28.605, 77.205, 100, 5);
    const normal2 = makeStation(2, 28.610, 77.210, 102, 8);
    const normal3 = makeStation(3, 28.615, 77.215, 103, 6);
    const normal4 = makeStation(5, 28.618, 77.218, 101, 7);
    // Outlier: AQI=800 is clamped to 500 by our schema, but we can test with a large value
    // that is well beyond 3σ of the cluster {100,102,103,101}: mean=101.5, stdDev≈1.1
    // 500 is >> 3σ from that mean
    const extreme = makeStation(4, 28.620, 77.220, 500, 5);

    const candidates = buildFusionCandidates([normal1, normal2, normal3, normal4, extreme], refLat, refLon, now);
    const filtered = filterOutliers(candidates);

    assert.ok(filtered.length < candidates.length, `Should filter at least 1 outlier; had ${candidates.length}, now ${filtered.length}`);
    assert.ok(!filtered.some(c => c.stationId === 4), "Extreme outlier station 4 should be excluded");
});

test("filterOutliers: identical AQI values → no filtering (stdDev = 0)", () => {
    const refLat = 28.6, refLon = 77.2;
    const now = new Date();
    const s1 = makeStation(1, 28.605, 77.205, 150, 5);
    const s2 = makeStation(2, 28.610, 77.210, 150, 5);
    const s3 = makeStation(3, 28.615, 77.215, 150, 5);

    const candidates = buildFusionCandidates([s1, s2, s3], refLat, refLon, now);
    const filtered = filterOutliers(candidates);
    assert.equal(filtered.length, candidates.length, "No filtering when all AQI are identical");
});

// ─── fuseStationReadings tests ─────────────────────────────────────────────

test("fuseStationReadings: normal fusion returns valid result", () => {
    const now = new Date();
    const stations = [
        makeStation(1, 28.600, 77.200, 100, 5),
        makeStation(2, 28.605, 77.205, 110, 8),
        makeStation(3, 28.610, 77.210, 105, 10),
    ];

    const result = fuseStationReadings(stations, 28.603, 77.203, now);
    assert.equal(result.status, "fused");
    assert.ok(Number.isFinite(result.fusedAQI) && result.fusedAQI >= 0 && result.fusedAQI <= 500);
    assert.ok(result.confidence > 0 && result.confidence <= 1);
    assert.ok(result.contributors.length >= 2);

    // Weight shares should sum to ~1
    const totalShare = result.contributors.reduce((s, c) => s + c.weightShare, 0);
    assert.ok(Math.abs(totalShare - 1.0) < 0.01, `Weight shares should sum to 1, got ${totalShare}`);
});

test("fuseStationReadings: single valid station returns single_station status", () => {
    const now = new Date();
    const stations = [makeStation(1, 28.600, 77.200, 130, 5)];

    const result = fuseStationReadings(stations, 28.600, 77.200, now);
    assert.equal(result.status, "single_station");
    assert.equal(result.fusedAQI, 130);
    assert.ok(result.confidence > 0 && result.confidence < 1);
});

test("fuseStationReadings: all stale → insufficient_data", () => {
    const now = new Date();
    const stations = [
        makeStation(1, 28.600, 77.200, 100, 130), // stale
        makeStation(2, 28.605, 77.205, 110, 125), // stale
    ];

    const result = fuseStationReadings(stations, 28.603, 77.203, now);
    assert.equal(result.status, "insufficient_data");
    assert.equal(result.fusedAQI, null);
    assert.equal(result.confidence, 0);
});

test("fuseStationReadings: missing AQI readings are excluded from fusion", () => {
    const now = new Date();
    const validStation = makeStation(1, 28.600, 77.200, 120, 5);
    const noAQI = {
        id: 2, name: "No AQI", latitude: 28.605, longitude: 77.205,
        readings: [{ aqi: null, latitude: 28.605, longitude: 77.205, recordedAt: new Date().toISOString() }]
    };
    const noReadings = { id: 3, latitude: 28.610, longitude: 77.210, readings: [] };

    const result = fuseStationReadings([validStation, noAQI, noReadings], 28.603, 77.203, now);
    // Only validStation qualifies → single_station
    assert.equal(result.status, "single_station");
    assert.equal(result.fusedAQI, 120);
});

test("fuseStationReadings: invalid inputs → error status", () => {
    const r1 = fuseStationReadings(null, 28.6, 77.2);
    assert.equal(r1.status, "error");

    const r2 = fuseStationReadings([], NaN, 77.2);
    assert.equal(r2.status, "error");
});

test("fuseNetworkReadings: computes centroid and delegates to fusion", () => {
    const now = new Date();
    const stations = [
        makeStation(1, 28.600, 77.200, 100, 5),
        makeStation(2, 28.610, 77.210, 110, 8),
        makeStation(3, 28.620, 77.220, 120, 6),
    ];

    const result = fuseNetworkReadings(stations, now);
    assert.ok(result.centroid !== null);
    assert.ok(Math.abs(result.centroid.lat - 28.610) < 0.001);
    assert.ok(["fused", "single_station"].includes(result.status));
});

test("fuseStationReadings: closest station gets highest weight share", () => {
    const now = new Date();
    // Station 1 is at exact reference point (0 km), station 2 is 10 km away
    const s1 = makeStation(1, 28.600, 77.200, 100, 5);  // at reference
    const s2 = makeStation(2, 28.700, 77.300, 200, 5);  // ~13 km away

    const result = fuseStationReadings([s1, s2], 28.600, 77.200, now);
    if (result.status === "fused") {
        const c1 = result.contributors.find(c => c.stationId === 1);
        const c2 = result.contributors.find(c => c.stationId === 2);
        assert.ok(c1.weightShare > c2.weightShare, "Closer station should get more weight");
        // Fused AQI should be pulled toward station 1 (AQI=100)
        assert.ok(result.fusedAQI < 150, "Fused AQI should be closer to nearer station");
    }
});

test("fuseStationReadings: per-pollutant fusion handles partial availability", () => {
    const now = new Date();
    // Station 1 has pm25, Station 2 has pm25+no2
    const s1 = makeStation(1, 28.600, 77.200, 100, 5, { pm25: 40, pm10: 70 });
    const s2 = makeStation(2, 28.605, 77.205, 110, 5, { pm25: 60, pm10: 90, no2: 30 });

    const result = fuseStationReadings([s1, s2], 28.603, 77.203, now);
    if (result.status === "fused") {
        assert.ok(result.fusedPollutants.pm25 !== null, "pm25 should be fused (both stations have it)");
        // no2 only available from station 2 — should still appear
        assert.ok(result.fusedPollutants.no2 !== null, "no2 should be present from station 2");
        // so2 is null in both — should be null
        assert.equal(result.fusedPollutants.so2, null);
    }
});
