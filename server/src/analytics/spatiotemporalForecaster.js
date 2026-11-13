/**
 * Spatiotemporal Air Quality Forecasting Engine
 *
 * Implements a time-series forecasting model combining:
 *   1. Adaptive Double Exponential Smoothing (Holt's Linear Trend with damping)
 *      adapted for non-uniform sampling intervals.
 *   2. Spatial Neighborhood Drift Integration using inverse-distance-weighted
 *      momentum from adjacent monitoring stations.
 *   3. Out-of-sample walk-forward historical evaluation (MAE, RMSE, Skill Score)
 *      guaranteeing zero future-data leakage.
 *   4. Horizon-dependent uncertainty interval estimation (compound error propagation).
 *
 * Predicts short-term future horizons (1h, 3h, 6h, 12h, 24h) for AQI and key pollutants.
 */

import { haversineKm } from "./sensorFusion.js";

const DEFAULT_ALPHA = 0.35; // Level smoothing weight
const DEFAULT_BETA = 0.15;  // Trend smoothing weight
const DEFAULT_PHI = 0.90;   // Trend damping parameter (prevents runaway linear divergence)
const MIN_READINGS_FOR_TREND = 3;
const MAX_SPATIAL_RADIUS_KM = 25;

/**
 * Validates and sorts historical readings chronologically (oldest to newest)
 * while filtering out invalid values.
 */
export function sanitizeHistory(readings, metric = "aqi") {
    if (!Array.isArray(readings) || readings.length === 0) return [];

    return readings
        .map(r => {
            const rawVal = r[metric];
            const hasVal = rawVal !== null && rawVal !== undefined && rawVal !== "" && typeof rawVal !== "boolean";
            const numVal = hasVal ? Number(rawVal) : null;
            const isValid = numVal !== null && Number.isFinite(numVal) && numVal >= 0;
            const ts = r.recordedAt ? new Date(r.recordedAt).getTime() : null;
            return {
                ...r,
                val: isValid ? numVal : null,
                timestamp: ts && Number.isFinite(ts) ? ts : null,
            };
        })
        .filter(r => r.val !== null && r.timestamp !== null)
        .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Adaptive Holt's Exponential Smoothing with interval-adjusted weights
 * for non-uniform time-step series.
 *
 * @param {Array<{val: number, timestamp: number}>} series - Chronological observations
 * @param {object} [params] - Hyperparameters
 * @returns {object} - Estimated final level, trend per hour, and residual standard error
 */
export function fitHoltModel(series, params = {}) {
    const alpha = params.alpha ?? DEFAULT_ALPHA;
    const beta = params.beta ?? DEFAULT_BETA;
    const phi = params.phi ?? DEFAULT_PHI;

    if (series.length < 2) {
        return {
            level: series[0]?.val ?? 0,
            trendPerHour: 0,
            residualStdError: 10,
            fittedValues: series.map(s => s.val),
            oneStepErrors: [0],
            phi,
        };
    }

    // Initialize level and trend from first two observations
    const dt0 = Math.max(0.1, (series[1].timestamp - series[0].timestamp) / 3600000);
    let level = series[0].val;
    let trend = (series[1].val - series[0].val) / dt0;

    const fittedValues = [level];
    const oneStepErrors = [];

    for (let i = 1; i < series.length; i++) {
        const dtHours = Math.max(0.1, (series[i].timestamp - series[i - 1].timestamp) / 3600000);

        // One-step-ahead prediction from previous state
        const pred = level + trend * dtHours;
        fittedValues.push(Math.round(pred * 10) / 10);

        const actual = series[i].val;
        const err = actual - pred;
        oneStepErrors.push(err);

        // Adjust smoothing parameters for time interval (scale relative to 1 hour baseline)
        const alphaDt = 1 - Math.pow(1 - alpha, Math.min(4, Math.max(0.25, dtHours)));
        const betaDt = 1 - Math.pow(1 - beta, Math.min(4, Math.max(0.25, dtHours)));

        const prevLevel = level;
        level = alphaDt * actual + (1 - alphaDt) * (level + trend * dtHours);
        trend = betaDt * ((level - prevLevel) / dtHours) + (1 - betaDt) * trend * Math.pow(phi, dtHours);
    }

    // Calculate residual standard error of 1-step errors
    const sse = oneStepErrors.reduce((acc, e) => acc + e * e, 0);
    const residualStdError = Math.sqrt(sse / Math.max(1, oneStepErrors.length));

    return {
        level,
        trendPerHour: trend,
        residualStdError: Math.max(3, residualStdError),
        fittedValues,
        oneStepErrors,
        phi,
    };
}

/**
 * Calculates spatial momentum/trend from neighboring stations.
 * If surrounding stations exhibit an upward trend, regional advection is factored in.
 */
export function computeSpatialDrift(stationLat, stationLon, nearbyStations, metric = "aqi") {
    if (!Number.isFinite(stationLat) || !Number.isFinite(stationLon) || !Array.isArray(nearbyStations) || nearbyStations.length === 0) {
        return { spatialTrendPerHour: 0, neighborCount: 0 };
    }

    let weightedTrendSum = 0;
    let totalWeight = 0;
    let count = 0;

    for (const neighbor of nearbyStations) {
        const nReadings = neighbor.readings;
        if (!Array.isArray(nReadings) || nReadings.length < 2) continue;

        const nLat = nReadings[0]?.latitude ?? neighbor.latitude;
        const nLon = nReadings[0]?.longitude ?? neighbor.longitude;
        if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) continue;

        const distKm = haversineKm(stationLat, stationLon, nLat, nLon);
        if (distKm <= 0.05 || distKm > MAX_SPATIAL_RADIUS_KM) continue;

        const cleanHistory = sanitizeHistory(nReadings, metric);
        if (cleanHistory.length < 2) continue;

        const neighborModel = fitHoltModel(cleanHistory);
        const weight = 1 / Math.pow(distKm, 1.5);

        weightedTrendSum += neighborModel.trendPerHour * weight;
        totalWeight += weight;
        count++;
    }

    if (totalWeight === 0) return { spatialTrendPerHour: 0, neighborCount: 0 };

    return {
        spatialTrendPerHour: weightedTrendSum / totalWeight,
        neighborCount: count,
    };
}

/**
 * Generates forward forecasts across a range of hourly horizons.
 *
 * @param {object[]} history - Historical readings of target station
 * @param {object} [options] - Configurations { horizonsHours, metric, nearbyStations, stationCoords }
 * @returns {object} - Forecast trajectories, confidence intervals, model metrics
 */
export function generateForecast(history, options = {}) {
    const metric = options.metric || "aqi";
    const horizonsHours = options.horizonsHours || [1, 3, 6, 12, 24];
    const cleanSeries = sanitizeHistory(history, metric);

    if (cleanSeries.length === 0) {
        return {
            status: "INSUFFICIENT_DATA",
            metric,
            latestObservation: null,
            forecasts: [],
            evaluation: null,
            uncertaintyBounds: [],
        };
    }

    const latest = cleanSeries[cleanSeries.length - 1];

    if (cleanSeries.length < MIN_READINGS_FOR_TREND) {
        // Fall back to persistence forecast with widening uncertainty
        const persistenceVal = latest.val;
        const forecasts = horizonsHours.map(h => ({
            horizonHours: h,
            targetTimestamp: new Date(latest.timestamp + h * 3600000).toISOString(),
            predictedValue: persistenceVal,
            lowerBound: Math.max(0, Math.round(persistenceVal - 15 * Math.sqrt(h))),
            upperBound: metric === "aqi"
                ? Math.min(500, Math.round(persistenceVal + 15 * Math.sqrt(h)))
                : Math.round(persistenceVal + 15 * Math.sqrt(h)),
            method: "PERSISTENCE_BASELINE",
            confidence: Math.max(0.2, Number((0.6 / Math.sqrt(h)).toFixed(2))),
        }));

        return {
            status: "LIMITED_HISTORY",
            metric,
            latestObservation: { value: latest.val, recordedAt: new Date(latest.timestamp).toISOString() },
            forecasts,
            evaluation: null,
            modelInfo: { method: "Naive Persistence", observationsUsed: cleanSeries.length },
        };
    }

    // Fit Holt's model
    const model = fitHoltModel(cleanSeries);

    // Incorporate spatial drift if coordinates and neighbors are available
    let spatialInfluence = { spatialTrendPerHour: 0, neighborCount: 0 };
    if (options.stationCoords && Array.isArray(options.nearbyStations)) {
        spatialInfluence = computeSpatialDrift(
            options.stationCoords.lat,
            options.stationCoords.lon,
            options.nearbyStations,
            metric
        );
    }

    // Blend local trend with spatial momentum (75% local, 25% regional consensus)
    const effectiveTrend = spatialInfluence.neighborCount > 0
        ? 0.75 * model.trendPerHour + 0.25 * spatialInfluence.spatialTrendPerHour
        : model.trendPerHour;

    // Generate horizon points
    const forecasts = horizonsHours.map(h => {
        // Damped trend forward projection: y_hat = level + trend * sum(phi^i)
        let trendMultiplier = 0;
        for (let i = 1; i <= h; i++) {
            trendMultiplier += Math.pow(model.phi, i);
        }

        let rawPrediction = model.level + effectiveTrend * trendMultiplier;

        // Physical bounds
        if (metric === "aqi") {
            rawPrediction = Math.max(0, Math.min(500, rawPrediction));
        } else {
            rawPrediction = Math.max(0, rawPrediction);
        }

        const predictedValue = Math.round(rawPrediction);

        // Compound prediction uncertainty interval (90% CI: ±1.645 * se * sqrt(1 + sum))
        const errorMultiplier = Math.sqrt(1 + (h - 1) * 0.25);
        const margin = 1.645 * model.residualStdError * errorMultiplier;

        const lowerBound = Math.max(0, Math.round(predictedValue - margin));
        const upperBound = metric === "aqi"
            ? Math.min(500, Math.round(predictedValue + margin))
            : Math.round(predictedValue + margin);

        // Confidence decays with forecast horizon and residual error
        const baseConfidence = Math.max(0.1, 1 - (model.residualStdError / (model.level || 50)));
        const confidence = Number(Math.max(0.15, Math.min(0.95, baseConfidence / Math.pow(h, 0.25))).toFixed(2));

        return {
            horizonHours: h,
            targetTimestamp: new Date(latest.timestamp + h * 3600000).toISOString(),
            predictedValue,
            lowerBound,
            upperBound,
            trendDirection: effectiveTrend > 1.5 ? "RISING" : effectiveTrend < -1.5 ? "FALLING" : "STABLE",
            confidence,
        };
    });

    // Evaluate model vs naive baseline using walk-forward validation on historical observations
    const evaluation = evaluateModelPerformance(cleanSeries);

    return {
        status: "OPTIMAL",
        metric,
        latestObservation: { value: latest.val, recordedAt: new Date(latest.timestamp).toISOString() },
        modelInfo: {
            method: "Damped Holt Exponential Smoothing + Spatial Momentum",
            observationsUsed: cleanSeries.length,
            level: Math.round(model.level * 10) / 10,
            trendPerHour: Math.round(effectiveTrend * 100) / 100,
            residualStdError: Math.round(model.residualStdError * 10) / 10,
            neighborsConsulted: spatialInfluence.neighborCount,
        },
        forecasts,
        evaluation,
    };
}

/**
 * Walk-Forward Out-of-Sample Historical Evaluation
 *
 * Validates predictions against past actuals without data leakage.
 * Computes MAE, RMSE, and Skill Score vs Naive Persistence (y_t+1 = y_t).
 */
export function evaluateModelPerformance(series) {
    if (!Array.isArray(series) || series.length < 4) {
        return {
            evaluableObservations: series?.length || 0,
            mae: null,
            rmse: null,
            skillScore: null,
            baselineRmse: null,
        };
    }

    const modelErrors = [];
    const baselineErrors = [];

    // Walk forward from observation 3 to n-1
    for (let t = 2; t < series.length - 1; t++) {
        const trainSlice = series.slice(0, t + 1);
        const actualNext = series[t + 1].val;
        const dtHours = Math.max(0.1, (series[t + 1].timestamp - series[t].timestamp) / 3600000);

        // Model 1-step prediction
        const model = fitHoltModel(trainSlice);
        const modelPred = Math.max(0, model.level + model.trendPerHour * dtHours);

        // Baseline (Naive persistence: next = current)
        const baselinePred = series[t].val;

        modelErrors.push(actualNext - modelPred);
        baselineErrors.push(actualNext - baselinePred);
    }

    const mae = Math.round((modelErrors.reduce((acc, e) => acc + Math.abs(e), 0) / modelErrors.length) * 10) / 10;
    const rmse = Math.round(Math.sqrt(modelErrors.reduce((acc, e) => acc + e * e, 0) / modelErrors.length) * 10) / 10;
    const baselineRmse = Math.round(Math.sqrt(baselineErrors.reduce((acc, e) => acc + e * e, 0) / baselineErrors.length) * 10) / 10;

    // Skill score: 1 - (RMSE_model / RMSE_baseline). Positive means beats naive persistence.
    let skillScore = 0;
    if (baselineRmse > 0) {
        skillScore = Number((1 - (rmse / baselineRmse)).toFixed(2));
    }

    return {
        evaluableObservations: modelErrors.length,
        mae,
        rmse,
        baselineRmse,
        skillScore,
        beatsPersistence: rmse <= baselineRmse,
    };
}
