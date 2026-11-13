/**
 * Explainable Pollution Source Attribution Engine
 *
 * Infers probable environmental pollution source categories from multi-pollutant
 * telemetry, diagnostic concentration ratios (PM2.5/PM10, CO/NO2, SO2/NO2),
 * and spatiotemporal diurnal patterns.
 *
 * Supported Source Categories:
 *   - VEHICULAR_TRAFFIC: Fine PM dominance, elevated NO2 & CO, diurnal rush-hour peaks.
 *   - CONSTRUCTION_DUST: Coarse PM dominance (PM2.5/PM10 < 0.40), low gaseous pollutants.
 *   - INDUSTRIAL_COMBUSTION: Elevated SO2, elevated NO2, heavy PM load.
 *   - PHOTOCHEMICAL_SMOG: Elevated tropospheric O3, midday solar intensity.
 *   - BIOMASS_BURNING: Very high PM2.5/PM10 ratio, elevated CO, moderate SO2.
 *   - URBAN_BACKGROUND: Low to moderate balanced baseline without extreme spikes.
 *   - INSUFFICIENT_DATA: Missing essential pollutant parameters.
 *
 * Designed with scientific qualification: All results are explicitly probabilistic
 * inferences categorized as SUPPORTED, POSSIBLE, or INCONCLUSIVE with explainable
 * evidence trails.
 */

export const SOURCE_CATEGORIES = {
    VEHICULAR_TRAFFIC: "Vehicular Traffic Emissions",
    CONSTRUCTION_DUST: "Construction & Road Dust Resuspension",
    INDUSTRIAL_COMBUSTION: "Industrial & Fossil Fuel Combustion",
    PHOTOCHEMICAL_SMOG: "Photochemical Smog & Ozone Formation",
    BIOMASS_BURNING: "Biomass / Agricultural Open Burning",
    URBAN_BACKGROUND: "Mixed Urban Background",
    INSUFFICIENT_DATA: "Insufficient Diagnostic Telemetry",
};

// National Ambient Air Quality / CPCB indicative reference baselines
export const BENCHMARKS = {
    pm25: 60,   // µg/m³ 24h
    pm10: 100,  // µg/m³ 24h
    no2: 80,    // µg/m³ 24h
    so2: 80,    // µg/m³ 24h
    co: 2.0,    // mg/m³ 8h
    o3: 100,    // µg/m³ 8h
};

/**
 * Validates whether a value is a non-negative finite number
 */
function isValidNum(val) {
    return val !== null && val !== undefined && Number.isFinite(Number(val)) && Number(val) >= 0;
}

/**
 * Determine local hour of the day from a date/timestamp (0 - 23)
 */
function getLocalHour(timestamp) {
    if (!timestamp) return null;
    const d = new Date(timestamp);
    if (!Number.isFinite(d.getTime())) return null;
    return d.getHours();
}

/**
 * Attributes the most probable pollution source profile for a given environmental reading.
 *
 * @param {object} reading - Environmental reading object { pm25, pm10, no2, so2, co, o3, aqi, recordedAt }
 * @param {object} [options] - Optional configurations { now: Date }
 * @returns {object} - Attribution result with scores, evidence, and confidence
 */
export function attributeReading(reading, options = {}) {
    if (!reading || typeof reading !== "object") {
        return {
            primarySource: "INSUFFICIENT_DATA",
            sourceLabel: SOURCE_CATEGORIES.INSUFFICIENT_DATA,
            status: "INCONCLUSIVE",
            confidence: 0,
            evidence: ["No reading payload provided."],
            limitations: ["Missing data prevents source attribution."],
            categoryScores: {},
            diagnosticRatios: {},
            qualifier: "No data available.",
        };
    }

    const pm25 = isValidNum(reading.pm25) ? Number(reading.pm25) : null;
    const pm10 = isValidNum(reading.pm10) ? Number(reading.pm10) : null;
    const no2 = isValidNum(reading.no2) ? Number(reading.no2) : null;
    const so2 = isValidNum(reading.so2) ? Number(reading.so2) : null;
    const co = isValidNum(reading.co) ? Number(reading.co) : null;
    const o3 = isValidNum(reading.o3) ? Number(reading.o3) : null;
    const aqi = isValidNum(reading.aqi) ? Number(reading.aqi) : null;

    // Count available diagnostic pollutants
    const availablePollutants = [pm25, pm10, no2, so2, co, o3].filter(v => v !== null).length;

    if (availablePollutants < 2 && aqi === null) {
        return {
            primarySource: "INSUFFICIENT_DATA",
            sourceLabel: SOURCE_CATEGORIES.INSUFFICIENT_DATA,
            status: "INCONCLUSIVE",
            confidence: 0,
            evidence: ["Fewer than two diagnostic pollutants available."],
            limitations: ["Source attribution requires at least two distinct pollutant measurements."],
            categoryScores: {},
            diagnosticRatios: {},
            qualifier: "Insufficient multi-pollutant telemetry for evidence-based attribution.",
        };
    }

    // Diagnostic ratios
    let pmRatio = null;
    if (pm25 !== null && pm10 !== null && pm10 > 0) {
        pmRatio = Math.round((pm25 / pm10) * 100) / 100;
    }

    let coNo2Ratio = null;
    if (co !== null && no2 !== null && no2 > 0) {
        coNo2Ratio = Math.round(((co * 1000) / no2) * 10) / 10; // mg to µg ratio
    }

    let so2No2Ratio = null;
    if (so2 !== null && no2 !== null && no2 > 0) {
        so2No2Ratio = Math.round((so2 / no2) * 100) / 100;
    }

    const hour = getLocalHour(reading.recordedAt || options.now);
    const isRushHour = hour !== null && ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 21));
    const isMiddaySolar = hour !== null && (hour >= 11 && hour <= 16);

    // Score accumulators & evidence records
    const scores = {
        VEHICULAR_TRAFFIC: 0,
        CONSTRUCTION_DUST: 0,
        INDUSTRIAL_COMBUSTION: 0,
        PHOTOCHEMICAL_SMOG: 0,
        BIOMASS_BURNING: 0,
        URBAN_BACKGROUND: 0,
    };

    const evidence = {
        VEHICULAR_TRAFFIC: [],
        CONSTRUCTION_DUST: [],
        INDUSTRIAL_COMBUSTION: [],
        PHOTOCHEMICAL_SMOG: [],
        BIOMASS_BURNING: [],
        URBAN_BACKGROUND: [],
    };

    // ─── 1. Vehicular Traffic Attribution ────────────────────────────────────
    if (no2 !== null && no2 >= 40) {
        scores.VEHICULAR_TRAFFIC += Math.min(35, (no2 / BENCHMARKS.no2) * 35);
        evidence.VEHICULAR_TRAFFIC.push(`Elevated NO2 concentration (${no2} µg/m³), indicative of internal combustion.`);
    }
    if (co !== null && co >= 0.8) {
        scores.VEHICULAR_TRAFFIC += Math.min(25, (co / BENCHMARKS.co) * 25);
        evidence.VEHICULAR_TRAFFIC.push(`Elevated CO (${co} mg/m³), indicating incomplete fuel combustion.`);
    }
    if (pmRatio !== null && pmRatio >= 0.60) {
        scores.VEHICULAR_TRAFFIC += 20;
        evidence.VEHICULAR_TRAFFIC.push(`High PM2.5/PM10 ratio (${pmRatio}) signifies fine combustion aerosol dominance.`);
    }
    if (isRushHour) {
        scores.VEHICULAR_TRAFFIC += 20;
        evidence.VEHICULAR_TRAFFIC.push(`Observation aligns with local peak traffic transit window (hour: ${hour}:00).`);
    }

    // ─── 2. Construction & Mechanical Dust Attribution ───────────────────────
    if (pmRatio !== null && pmRatio < 0.45 && pm10 !== null && pm10 > 80) {
        scores.CONSTRUCTION_DUST += 50;
        evidence.CONSTRUCTION_DUST.push(`Coarse particulate dominance with low PM2.5/PM10 ratio (${pmRatio}) and elevated PM10 (${pm10} µg/m³).`);
    }
    if (pm10 !== null && pm10 > 150) {
        scores.CONSTRUCTION_DUST += 25;
        evidence.CONSTRUCTION_DUST.push(`Very high PM10 (${pm10} µg/m³) indicates mechanical ground agitation.`);
    }
    if (no2 !== null && no2 < 30 && so2 !== null && so2 < 25) {
        scores.CONSTRUCTION_DUST += 25;
        evidence.CONSTRUCTION_DUST.push(`Low gaseous combustion markers (NO2: ${no2} µg/m³, SO2: ${so2} µg/m³), disfavoring industrial/traffic origins.`);
    }

    // ─── 3. Industrial & Fossil Combustion Attribution ───────────────────────
    if (so2 !== null && so2 >= 30) {
        scores.INDUSTRIAL_COMBUSTION += Math.min(45, (so2 / BENCHMARKS.so2) * 45);
        evidence.INDUSTRIAL_COMBUSTION.push(`Elevated SO2 (${so2} µg/m³), characteristic of sulfurous coal/oil industrial boilers.`);
    }
    if (so2No2Ratio !== null && so2No2Ratio >= 0.6) {
        scores.INDUSTRIAL_COMBUSTION += 25;
        evidence.INDUSTRIAL_COMBUSTION.push(`Elevated SO2/NO2 ratio (${so2No2Ratio}), pointing toward industrial point sources rather than urban traffic.`);
    }
    if (pm25 !== null && pm25 > 90) {
        scores.INDUSTRIAL_COMBUSTION += 20;
        evidence.INDUSTRIAL_COMBUSTION.push(`Heavy fine aerosol loading (PM2.5: ${pm25} µg/m³).`);
    }
    if (co !== null && co >= 1.5) {
        scores.INDUSTRIAL_COMBUSTION += 10;
    }

    // ─── 4. Photochemical Smog & Ozone Formation ─────────────────────────────
    if (o3 !== null && o3 >= 60) {
        scores.PHOTOCHEMICAL_SMOG += Math.min(50, (o3 / BENCHMARKS.o3) * 50);
        evidence.PHOTOCHEMICAL_SMOG.push(`Elevated tropospheric Ozone (${o3} µg/m³), typical of secondary photochemical reaction.`);
    }
    if (isMiddaySolar) {
        scores.PHOTOCHEMICAL_SMOG += 25;
        evidence.PHOTOCHEMICAL_SMOG.push(`Peak solar radiation window (hour: ${hour}:00) promoting photochemical oxidation.`);
    }
    if (o3 !== null && o3 >= 80 && no2 !== null && no2 <= 50) {
        scores.PHOTOCHEMICAL_SMOG += 25;
        evidence.PHOTOCHEMICAL_SMOG.push(`O3 titration signature: Elevated O3 with moderated NO2.`);
    }

    // ─── 5. Biomass / Agricultural Open Burning ──────────────────────────────
    if (pmRatio !== null && pmRatio >= 0.70 && pm25 !== null && pm25 >= 100) {
        scores.BIOMASS_BURNING += 45;
        evidence.BIOMASS_BURNING.push(`Intense fine particulate dominance (PM2.5: ${pm25} µg/m³, ratio: ${pmRatio}), typical of organic biomass smoke.`);
    }
    if (co !== null && co >= 1.5) {
        scores.BIOMASS_BURNING += 30;
        evidence.BIOMASS_BURNING.push(`Elevated carbon monoxide (${co} mg/m³), indicating smoldering biomass combustion.`);
    }
    if (so2 !== null && so2 < 20) {
        scores.BIOMASS_BURNING += 25;
        evidence.BIOMASS_BURNING.push(`Low SO2 concentration (${so2} µg/m³), distinguishing biomass smoke from coal/petroleum combustion.`);
    }

    // ─── 6. Mixed Urban Background ───────────────────────────────────────────
    const isModerateAQI = aqi !== null && aqi <= 100;
    const isLowGases = (no2 === null || no2 < 35) && (so2 === null || so2 < 20) && (co === null || co < 1.0) && (o3 === null || o3 < 50);
    const isModeratePM = (pm25 === null || pm25 < 45) && (pm10 === null || pm10 < 80);

    if ((isModerateAQI && isLowGases) || (isLowGases && isModeratePM)) {
        scores.URBAN_BACKGROUND += 60;
        evidence.URBAN_BACKGROUND.push(`Sub-acute pollutant concentrations across all monitoring channels.`);
        if (pmRatio !== null && pmRatio >= 0.45 && pmRatio <= 0.65) {
            scores.URBAN_BACKGROUND += 40;
            evidence.URBAN_BACKGROUND.push(`Well-mixed PM2.5/PM10 ratio (${pmRatio}) reflecting diffuse background urban aerosol.`);
        }
    }

    // Determine highest scoring category
    let bestCategory = "URBAN_BACKGROUND";
    let maxScore = -1;

    for (const [cat, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            bestCategory = cat;
        }
    }

    // Normalize confidence to [0, 1]
    const clampedScore = Math.min(100, Math.max(0, maxScore));
    let confidence = Number((clampedScore / 100).toFixed(2));

    // Penalty if few diagnostic pollutants available
    if (availablePollutants < 3) {
        confidence = Number((confidence * 0.75).toFixed(2));
    }

    // Status qualification
    let status = "INCONCLUSIVE";
    if (confidence >= 0.65) {
        status = "SUPPORTED";
    } else if (confidence >= 0.40) {
        status = "POSSIBLE";
    }

    const limitations = [];
    if (availablePollutants < 4) {
        limitations.push(`Only ${availablePollutants} of 6 key diagnostic pollutants available (SO2, NO2, CO, O3, PM2.5, PM10).`);
    }
    if (pmRatio === null) {
        limitations.push("Missing simultaneous PM2.5 and PM10 prevents particulate size-fraction diagnosis.");
    }
    limitations.push("Attribution represents statistical environmental pattern recognition; not chemical speciation.");

    return {
        primarySource: bestCategory,
        sourceLabel: SOURCE_CATEGORIES[bestCategory],
        status,
        confidence,
        evidence: evidence[bestCategory].length > 0 ? evidence[bestCategory] : ["Baseline urban concentration pattern observed."],
        limitations,
        categoryScores: Object.fromEntries(
            Object.entries(scores).map(([k, v]) => [k, Math.min(100, Math.round(v))])
        ),
        diagnosticRatios: {
            pmRatio,
            coNo2Ratio,
            so2No2Ratio,
        },
        qualifier: `${status === "SUPPORTED" ? "Strongly supported" : status === "POSSIBLE" ? "Plausible" : "Uncertain"} match for ${SOURCE_CATEGORIES[bestCategory]} based on multi-channel pollutant telemetry.`,
    };
}

/**
 * Attributes pollution sources for an entire station, considering current reading
 * and historical temporal trajectory.
 *
 * @param {object} station - Station object with readings array
 * @param {object[]} [history] - Historical readings array
 * @param {object} [options] - Options
 */
export function attributeStation(station, history = [], options = {}) {
    if (!station || typeof station !== "object") {
        return {
            stationId: null,
            stationName: "Unknown",
            attribution: attributeReading(null),
        };
    }

    const currentReading = station.readings?.[0] || history[0] || null;
    const attribution = attributeReading(currentReading, options);

    // Analyze temporal consistency if historical readings are provided
    let temporalConsistency = null;
    if (Array.isArray(history) && history.length >= 3) {
        const historyAttributions = history.slice(0, 10).map(r => attributeReading(r, options).primarySource);
        const matchCount = historyAttributions.filter(src => src === attribution.primarySource).length;
        const consistencyRate = Math.round((matchCount / historyAttributions.length) * 100);
        temporalConsistency = {
            analyzedReadings: historyAttributions.length,
            dominantHistoricalSource: attribution.primarySource,
            consistencyRate,
            isPersistent: consistencyRate >= 60,
        };
    }

    return {
        stationId: station.id,
        stationName: station.name || `Station ${station.id}`,
        stationType: station.type || "FIXED",
        attribution,
        temporalConsistency,
    };
}

/**
 * Analyzes network-wide pollution source patterns across all monitored stations.
 *
 * @param {object[]} stations - Array of station objects
 * @param {object} [options] - Options
 */
export function attributeNetwork(stations, options = {}) {
    if (!Array.isArray(stations) || stations.length === 0) {
        return {
            totalStations: 0,
            primaryRegionalDriver: "INSUFFICIENT_DATA",
            sourceDistribution: {},
            stationAttributions: [],
        };
    }

    const stationAttributions = stations.map(s => attributeStation(s, s.readings || [], options));
    const distribution = {};

    for (const item of stationAttributions) {
        const src = item.attribution.primarySource;
        distribution[src] = (distribution[src] || 0) + 1;
    }

    let primaryRegionalDriver = "URBAN_BACKGROUND";
    let maxCount = -1;
    for (const [src, count] of Object.entries(distribution)) {
        if (count > maxCount && src !== "INSUFFICIENT_DATA") {
            maxCount = count;
            primaryRegionalDriver = src;
        }
    }

    return {
        totalStations: stationAttributions.length,
        primaryRegionalDriver,
        primaryRegionalDriverLabel: SOURCE_CATEGORIES[primaryRegionalDriver],
        sourceDistribution: distribution,
        stationAttributions,
    };
}
