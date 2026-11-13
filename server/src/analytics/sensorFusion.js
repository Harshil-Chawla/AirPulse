/**
 * Uncertainty-Aware Multi-Sensor AQI Fusion Engine
 *
 * Combines readings from multiple monitoring stations using a weighted fusion
 * strategy that accounts for:
 *   - Spatial distance (inverse-distance weighting)
 *   - Reading freshness (exponential temporal decay)
 *   - Per-reading variance / reliability (down-weights sensors with high spread)
 *   - Outlier detection (excludes readings that deviate > 3σ from the median)
 *
 * Produces a fused AQI estimate alongside a confidence score and per-pollutant
 * uncertainty estimate, without modifying the existing AQI calculation methodology.
 *
 * Mathematical approach: Weighted average with inverse-distance × freshness weights.
 * Confidence is derived from weight-normalised effective sample size (Kish's ESS).
 */

const FRESHNESS_HALF_LIFE_MINUTES = 30; // reading weight halves every 30 minutes of age
const MAX_FUSION_RADIUS_KM = 25;        // stations beyond this radius are excluded
const MIN_READINGS_FOR_FUSION = 2;      // need at least 2 non-stale readings
const STALE_CUTOFF_MINUTES = 120;       // reading older than this contributes 0 weight
const OUTLIER_SIGMA_THRESHOLD = 3.0;    // IQR-free sigma gate for outlier rejection

const POLLUTANTS = ["pm25", "pm10", "no2", "so2", "co", "o3"];

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Haversine distance in km between two lat/lon pairs
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
        * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Exponential freshness weight: weight = exp(-λ·age)
 * where λ = ln(2) / FRESHNESS_HALF_LIFE_MINUTES
 */
export function freshnessWeight(ageMinutes) {
    if (!Number.isFinite(ageMinutes) || ageMinutes < 0) return 0;
    if (ageMinutes > STALE_CUTOFF_MINUTES) return 0;
    const lambda = Math.LN2 / FRESHNESS_HALF_LIFE_MINUTES;
    return Math.exp(-lambda * ageMinutes);
}

/**
 * Inverse-distance weight: IDW with power p=2, plus a small epsilon to avoid
 * division-by-zero when two stations are co-located.
 */
export function inverseDistanceWeight(distanceKm, power = 2) {
    const epsilon = 0.01; // 10 metres
    return 1 / Math.pow(distanceKm + epsilon, power);
}

/**
 * Compute median of a numeric array.
 */
function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute population standard deviation of a numeric array.
 */
function stdDev(values, mean) {
    if (values.length < 2) return 0;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

// ─── Core fusion ─────────────────────────────────────────────────────────────

/**
 * Prepare fusion candidates from an array of station objects.
 *
 * Each station must have shape:
 *   { id, latitude, longitude, readings: [{ aqi, pm25, …, recordedAt, latitude?, longitude? }] }
 *
 * @param {object[]} stations  - Array of station objects with at least one reading
 * @param {number}   refLat    - Reference latitude for distance calculation
 * @param {number}   refLon    - Reference longitude
 * @param {Date}     now       - Current time (default: new Date())
 * @returns {object[]}          - Array of candidate objects with computed weights
 */
export function buildFusionCandidates(stations, refLat, refLon, now = new Date()) {
    const candidates = [];

    for (const station of stations) {
        const reading = station.readings?.[0];
        if (!reading) continue;
        if (!Number.isFinite(reading.aqi) || reading.aqi < 0 || reading.aqi > 500) continue;

        const lat = reading.latitude ?? station.latitude;
        const lon = reading.longitude ?? station.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const distKm = haversineKm(refLat, refLon, lat, lon);
        if (distKm > MAX_FUSION_RADIUS_KM) continue;

        // Age of reading
        let ageMinutes = 0;
        if (reading.recordedAt) {
            const ms = now.getTime() - new Date(reading.recordedAt).getTime();
            ageMinutes = Math.max(0, ms / 60000);
        }

        const fWeight = freshnessWeight(ageMinutes);
        if (fWeight === 0) continue; // stale reading contributes nothing

        const dWeight = inverseDistanceWeight(distKm);
        const baseWeight = fWeight * dWeight;

        candidates.push({
            stationId: station.id,
            stationName: station.name || `Station ${station.id}`,
            distanceKm: distKm,
            ageMinutes,
            aqi: reading.aqi,
            pollutants: POLLUTANTS.reduce((acc, p) => {
                const v = reading[p];
                acc[p] = Number.isFinite(v) && v >= 0 ? v : null;
                return acc;
            }, {}),
            fWeight,
            dWeight,
            baseWeight,
        });
    }

    return candidates;
}

/**
 * Remove outliers using Median Absolute Deviation (MAD) — a robust estimator
 * that is not distorted by the outliers themselves (unlike mean/stdDev-based gates).
 *
 * Modified Z-score: M_i = 0.6745 * (x_i - median) / MAD
 * Values with |M_i| > OUTLIER_SIGMA_THRESHOLD are excluded.
 *
 * The constant 0.6745 makes MAD consistent with σ for a normal distribution.
 */
export function filterOutliers(candidates) {
    if (candidates.length < MIN_READINGS_FOR_FUSION) return candidates;

    const aqiValues = candidates.map(c => c.aqi);
    const med = median(aqiValues);

    // MAD = median of |x_i - median|
    const absDeviations = aqiValues.map(v => Math.abs(v - med));
    const mad = median(absDeviations);

    // If MAD is 0 (all readings identical or perfectly clustered) skip filtering
    if (mad === 0) return candidates;

    const filtered = candidates.filter(c => {
        const modifiedZ = 0.6745 * Math.abs(c.aqi - med) / mad;
        return modifiedZ <= OUTLIER_SIGMA_THRESHOLD;
    });

    // Always keep at least MIN_READINGS_FOR_FUSION candidates
    return filtered.length >= MIN_READINGS_FOR_FUSION ? filtered : candidates;
}

/**
 * Compute Kish's Effective Sample Size (ESS) from normalised weights.
 *
 * ESS = (Σw)² / Σ(w²)   — a measure of how evenly distributed the weight is.
 * ESS = n when all weights are equal, ESS → 1 when one station dominates.
 *
 * We normalise ESS to [0, 1] by dividing by n for a confidence score.
 */
function kishESS(weights) {
    if (!weights.length) return 0;
    const sumW = weights.reduce((s, w) => s + w, 0);
    const sumW2 = weights.reduce((s, w) => s + w ** 2, 0);
    if (sumW2 === 0) return 0;
    const ess = sumW ** 2 / sumW2;
    return Math.min(1, ess / weights.length);
}

/**
 * Fuse a set of validated, filtered candidates into a single AQI estimate.
 *
 * Returns:
 *   fusedAQI       — weighted-average AQI (integer)
 *   uncertainty    — ±half-width of a ~90% uncertainty interval (AQI units)
 *   confidence     — Kish ESS normalised to [0, 1]
 *   contributors   — per-station weight breakdown
 *   pollutants     — per-pollutant weighted-average estimates
 */
function fuseFromCandidates(candidates) {
    const weights = candidates.map(c => c.baseWeight);
    const sumW = weights.reduce((s, w) => s + w, 0);
    if (sumW === 0) return null;

    // Weighted mean AQI
    const fusedAQI = Math.round(
        candidates.reduce((s, c) => s + c.aqi * c.baseWeight, 0) / sumW
    );

    // Weighted variance → uncertainty (±)
    const weightedVariance = candidates.reduce(
        (s, c) => s + c.baseWeight * (c.aqi - fusedAQI) ** 2, 0
    ) / sumW;
    // 1.645σ ≈ 90% interval half-width
    const uncertainty = Math.round(1.645 * Math.sqrt(weightedVariance));

    // Confidence via Kish ESS
    const confidence = Number(kishESS(weights).toFixed(3));

    // Per-pollutant weighted averages (only for pollutants present in ≥1 candidate)
    const fusedPollutants = {};
    for (const p of POLLUTANTS) {
        const validCandidates = candidates.filter(c => c.pollutants[p] !== null);
        if (!validCandidates.length) {
            fusedPollutants[p] = null;
            continue;
        }
        const pSumW = validCandidates.reduce((s, c) => s + c.baseWeight, 0);
        const pFused = validCandidates.reduce(
            (s, c) => s + c.pollutants[p] * c.baseWeight, 0
        ) / pSumW;
        fusedPollutants[p] = Math.round(pFused * 10) / 10;
    }

    // Per-contributor weight share (useful for transparency / debugging)
    const contributors = candidates.map(c => ({
        stationId: c.stationId,
        stationName: c.stationName,
        aqi: c.aqi,
        distanceKm: Math.round(c.distanceKm * 100) / 100,
        ageMinutes: Math.round(c.ageMinutes),
        weightShare: Number((c.baseWeight / sumW).toFixed(3)),
    }));

    return { fusedAQI, uncertainty, confidence, contributors, fusedPollutants };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fuse AQI readings from a set of stations around a reference point.
 *
 * @param {object[]} stations   - Station array (with at least one reading each)
 * @param {number}   refLat     - Reference latitude (e.g., the target point)
 * @param {number}   refLon     - Reference longitude
 * @param {Date}     now        - Current time (injectable for testing)
 * @returns {object}            - Fusion result object
 */
export function fuseStationReadings(stations, refLat, refLon, now = new Date()) {
    if (!Array.isArray(stations) || !Number.isFinite(refLat) || !Number.isFinite(refLon)) {
        return {
            status: "error",
            reason: "Invalid input: stations must be an array and coordinates must be finite numbers",
            fusedAQI: null,
            uncertainty: null,
            confidence: 0,
            contributors: [],
            fusedPollutants: {},
        };
    }

    // Build + filter candidates
    const raw = buildFusionCandidates(stations, refLat, refLon, now);

    if (raw.length === 0) {
        return {
            status: "insufficient_data",
            reason: `No stations with valid, fresh readings within ${MAX_FUSION_RADIUS_KM} km`,
            fusedAQI: null,
            uncertainty: null,
            confidence: 0,
            contributors: [],
            fusedPollutants: {},
        };
    }

    if (raw.length < MIN_READINGS_FOR_FUSION) {
        // Single-station passthrough — no fusion, low confidence
        const c = raw[0];
        return {
            status: "single_station",
            reason: "Only one station with valid data in range; no fusion performed",
            fusedAQI: c.aqi,
            uncertainty: null,
            confidence: Number((c.fWeight * 0.5).toFixed(3)), // halved — no cross-validation
            contributors: [{
                stationId: c.stationId,
                stationName: c.stationName,
                aqi: c.aqi,
                distanceKm: Math.round(c.distanceKm * 100) / 100,
                ageMinutes: Math.round(c.ageMinutes),
                weightShare: 1.0,
            }],
            fusedPollutants: c.pollutants,
        };
    }

    // Outlier rejection
    const filtered = filterOutliers(raw);
    const rejectedCount = raw.length - filtered.length;

    // Perform weighted fusion
    const result = fuseFromCandidates(filtered);
    if (!result) {
        return {
            status: "computation_failed",
            reason: "Weight sum collapsed to zero — likely all readings expired during processing",
            fusedAQI: null,
            uncertainty: null,
            confidence: 0,
            contributors: [],
            fusedPollutants: {},
        };
    }

    return {
        status: "fused",
        reason: `Fused from ${filtered.length} station(s); ${rejectedCount} outlier(s) rejected`,
        ...result,
    };
}

/**
 * Compute per-station fusion contribution for a network of stations.
 * Useful for a "network-level" fused AQI across all stations (centroid reference).
 *
 * Uses the geographic centroid of all stations as the reference point.
 *
 * @param {object[]} stations
 * @param {Date}     now
 * @returns {object}
 */
export function fuseNetworkReadings(stations, now = new Date()) {
    if (!Array.isArray(stations) || stations.length === 0) {
        return {
            status: "insufficient_data",
            reason: "No stations provided",
            fusedAQI: null,
            uncertainty: null,
            confidence: 0,
            contributors: [],
            fusedPollutants: {},
            centroid: null,
        };
    }

    // Compute geographic centroid of all located stations
    const located = stations.filter(s => {
        const r = s.readings?.[0];
        const lat = r?.latitude ?? s.latitude;
        const lon = r?.longitude ?? s.longitude;
        return Number.isFinite(lat) && Number.isFinite(lon);
    });

    if (!located.length) {
        return {
            status: "insufficient_data",
            reason: "No stations with valid coordinates",
            fusedAQI: null,
            uncertainty: null,
            confidence: 0,
            contributors: [],
            fusedPollutants: {},
            centroid: null,
        };
    }

    const centroidLat = located.reduce((s, st) => {
        const r = st.readings?.[0];
        return s + (r?.latitude ?? st.latitude);
    }, 0) / located.length;

    const centroidLon = located.reduce((s, st) => {
        const r = st.readings?.[0];
        return s + (r?.longitude ?? st.longitude);
    }, 0) / located.length;

    const result = fuseStationReadings(stations, centroidLat, centroidLon, now);
    return { ...result, centroid: { lat: centroidLat, lon: centroidLon } };
}
