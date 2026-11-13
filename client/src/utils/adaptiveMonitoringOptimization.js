import { calculateDistanceKm } from "./anomalyDetection.js";

/**
 * Adaptive Mobile Monitoring Deployment Engine
 * 
 * Computes optimal next-waypoint deployments for mobile vans and drones using
 * a multi-criteria optimization function combining pollution severity, coverage gaps,
 * reading freshness, and vehicle operational range constraints.
 */

export const OPTIMIZATION_WEIGHTS = {
    severity: 0.35,
    coverageGap: 0.30,
    freshness: 0.20,
    distanceCost: 0.15,
};

export const VEHICLE_CONSTRAINTS = {
    MOBILE: {
        maxRangeKm: 8.0,
        optimalStepKm: 0.5,
        unitLabel: "Mobile Vehicle Van",
    },
    DRONE: {
        maxRangeKm: 3.5,
        optimalStepKm: 0.3,
        unitLabel: "UAV Aerial Drone",
    },
};

/**
 * Calculate multi-criteria priority score for a candidate destination
 */
export function evaluateCandidateWaypoint({
    candidateLat,
    candidateLon,
    candidateName,
    station,
    allStations,
    estimatedAQI = 150,
    lastSampledTime = null,
    now = Date.now(),
}) {
    const sReading = station.readings?.[0];
    const sLat = sReading?.latitude ?? station.latitude;
    const sLon = sReading?.longitude ?? station.longitude;

    const distanceKm = calculateDistanceKm(sLat, sLon, candidateLat, candidateLon);
    const constraints = VEHICLE_CONSTRAINTS[station.type] || VEHICLE_CONSTRAINTS.MOBILE;

    // 1. Severity Score (0 - 100)
    const severityScore = Math.min(100, Math.max(0, (estimatedAQI / 400) * 100));

    // 2. Coverage Gap Score (0 - 100): High score if few dynamic stations are nearby
    const nearbyDynamic = allStations.filter(other => {
        if (other.id === station.id) return false;
        if (other.type !== "MOBILE" && other.type !== "DRONE") return false;
        const oR = other.readings?.[0];
        const oLat = oR?.latitude ?? other.latitude;
        const oLon = oR?.longitude ?? other.longitude;
        return calculateDistanceKm(candidateLat, candidateLon, oLat, oLon) <= 2.0;
    });
    const coverageGapScore = Math.max(0, 100 - nearbyDynamic.length * 40);

    // 3. Freshness Score (0 - 100): Increases if data in sector is old
    let freshnessScore = 50;
    if (lastSampledTime) {
        const ageMinutes = (now - new Date(lastSampledTime).getTime()) / 60000;
        freshnessScore = Math.min(100, Math.max(0, (ageMinutes / 60) * 100));
    }

    // 4. Distance / Energy Cost Penalty (0 - 100)
    const distancePenalty = Math.min(100, (distanceKm / constraints.maxRangeKm) * 100);
    const distanceEfficiencyScore = Math.max(0, 100 - distancePenalty);

    // Weighted composite score (0 - 100)
    const rawScore =
        OPTIMIZATION_WEIGHTS.severity * severityScore +
        OPTIMIZATION_WEIGHTS.coverageGap * coverageGapScore +
        OPTIMIZATION_WEIGHTS.freshness * freshnessScore +
        OPTIMIZATION_WEIGHTS.distanceCost * distanceEfficiencyScore;

    const priorityScore = Number(rawScore.toFixed(1));
    const isWithinOperationalRange = distanceKm <= constraints.maxRangeKm;

    // Transparent rationale explanation
    const explanations = [];
    if (severityScore >= 60) explanations.push(`Elevated estimated pollution (~${estimatedAQI} AQI) requires active verification`);
    if (coverageGapScore >= 70) explanations.push(`Zero nearby mobile/drone assets within 2 km radius`);
    if (freshnessScore >= 60) explanations.push(`Telemetry age exceeds threshold; fresh sampling required`);
    if (distanceKm <= constraints.optimalStepKm * 2) explanations.push(`Favorable transit range (${distanceKm.toFixed(2)} km) optimizes battery/fuel efficiency`);
    else if (!isWithinOperationalRange) explanations.push(`Exceeds vehicle operational boundary limit of ${constraints.maxRangeKm} km`);

    return {
        candidateName,
        candidateLat,
        candidateLon,
        distanceKm,
        isWithinOperationalRange,
        priorityScore,
        estimatedAQI,
        scoreBreakdown: {
            severity: Number(severityScore.toFixed(1)),
            coverageGap: Number(coverageGapScore.toFixed(1)),
            freshness: Number(freshnessScore.toFixed(1)),
            distanceEfficiency: Number(distanceEfficiencyScore.toFixed(1)),
        },
        rationale: explanations.join("; ") || "Standard routine coverage patrol.",
    };
}

/**
 * Generate ranked deployment options for all dynamic mobile/drone stations
 */
export function computeAdaptiveDeployments(stations, now = Date.now()) {
    if (!Array.isArray(stations) || stations.length === 0) {
        return [];
    }

    const dynamicStations = stations.filter(s => s.type === "MOBILE" || s.type === "DRONE");
    if (dynamicStations.length === 0) return [];

    const deployments = [];

    // Synthesize candidate sectors from existing station clusters and boundary offsets
    for (const station of dynamicStations) {
        const sR = station.readings?.[0];
        const sLat = sR?.latitude ?? station.latitude;
        const sLon = sR?.longitude ?? station.longitude;
        const step = station.type === "DRONE" ? 0.005 : 0.008;

        // Generate cardinal waypoints surrounding current position
        const candidates = [
            {
                name: `North Sector (${(sLat + step).toFixed(3)}°N)`,
                lat: Number((sLat + step).toFixed(4)),
                lon: Number(sLon.toFixed(4)),
                estAQI: Math.min(500, Math.round((sR?.aqi ?? 150) * 1.1)),
            },
            {
                name: `East Sector (${(sLon + step).toFixed(3)}°E)`,
                lat: Number(sLat.toFixed(4)),
                lon: Number((sLon + step).toFixed(4)),
                estAQI: Math.max(50, Math.round((sR?.aqi ?? 150) * 0.95)),
            },
            {
                name: `South-West Sector (${(sLat - step).toFixed(3)}°N)`,
                lat: Number((sLat - step).toFixed(4)),
                lon: Number((sLon - step).toFixed(4)),
                estAQI: Math.min(500, Math.round((sR?.aqi ?? 150) * 1.15)),
            },
            {
                name: `Downwind Transect (${(sLat + step * 0.7).toFixed(3)}°N)`,
                lat: Number((sLat + step * 0.7).toFixed(4)),
                lon: Number((sLon - step * 0.7).toFixed(4)),
                estAQI: Math.min(500, Math.round((sR?.aqi ?? 150) * 1.05)),
            },
        ];

        const evaluatedWaypoints = candidates
            .map(c => evaluateCandidateWaypoint({
                candidateLat: c.lat,
                candidateLon: c.lon,
                candidateName: c.name,
                station,
                allStations: stations,
                estimatedAQI: c.estAQI,
                lastSampledTime: sR?.recordedAt,
                now,
            }))
            .filter(w => w.isWithinOperationalRange)
            .sort((a, b) => b.priorityScore - a.priorityScore);

        if (evaluatedWaypoints.length > 0) {
            deployments.push({
                stationId: station.id,
                stationName: station.name,
                stationType: station.type,
                currentCoords: { lat: sLat, lon: sLon },
                currentAQI: sR?.aqi ?? null,
                optimalWaypoint: evaluatedWaypoints[0],
                allWaypoints: evaluatedWaypoints,
            });
        }
    }

    return deployments.sort((a, b) => b.optimalWaypoint.priorityScore - a.optimalWaypoint.priorityScore);
}
