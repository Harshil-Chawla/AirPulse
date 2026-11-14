import { calculateDistanceKm } from "./anomalyDetection.js";

export function analyzeCoverage(stations) {
    if (!Array.isArray(stations) || stations.length === 0) {
        return {
            totalStations: 0,
            coverageScore: 0,
            activeSectors: [],
            coverageGaps: [],
            gapCount: 0,
        };
    }

    const located = stations.filter(s => {
        const r = s.readings?.[0];
        const lat = r?.latitude ?? s.latitude;
        const lon = r?.longitude ?? s.longitude;
        return Number.isFinite(lat) && Number.isFinite(lon);
    });

    if (located.length === 0) {
        return {
            totalStations: 0,
            coverageScore: 0,
            activeSectors: [],
            coverageGaps: [],
            gapCount: 0,
        };
    }

    const sectors = new Map();

    for (const station of located) {
        const r = station.readings?.[0];
        const lat = r?.latitude ?? station.latitude;
        const lon = r?.longitude ?? station.longitude;
        const aqi = Number.isFinite(r?.aqi) ? r.aqi : null;

        const cellKey = `${(Math.floor(lat / 0.012) * 0.012).toFixed(3)},${(Math.floor(lon / 0.014) * 0.014).toFixed(3)}`;
        
        if (!sectors.has(cellKey)) {
            sectors.set(cellKey, {
                sectorKey: cellKey,
                centerLat: lat,
                centerLon: lon,
                stations: [],
                fixedCount: 0,
                mobileCount: 0,
                droneCount: 0,
                maxAQI: null,
            });
        }

        const sector = sectors.get(cellKey);
        sector.stations.push(station);
        if (station.type === "FIXED") sector.fixedCount++;
        else if (station.type === "MOBILE") sector.mobileCount++;
        else if (station.type === "DRONE") sector.droneCount++;

        if (aqi !== null) {
            sector.maxAQI = sector.maxAQI === null ? aqi : Math.max(sector.maxAQI, aqi);
        }
    }

    const coverageGaps = [];
    const activeSectors = [];

    for (const [key, sec] of sectors.entries()) {
        const dynamicCount = sec.mobileCount + sec.droneCount;
        const total = sec.stations.length;
        
        let status = "Adequate";
        let statusClass = "adequate";
        let gapReason = null;
        let priority = "LOW";

        if (dynamicCount === 0 && (sec.maxAQI === null || sec.maxAQI >= 150)) {
            status = "Critical Gap";
            statusClass = "critical";
            priority = "HIGH";
            gapReason = "High pollution reported with zero mobile/drone verification. High risk of localized spikes.";
        } else if (dynamicCount === 0) {
            status = "Static Only";
            statusClass = "moderate-gap";
            priority = "MEDIUM";
            gapReason = "Monitored solely by fixed station. Hyperlocal dispersion and street-level exposure unknown.";
        } else if (total === 1) {
            status = "Low Redundancy";
            statusClass = "low-gap";
            priority = "LOW";
            gapReason = "Single sensor observation; cross-validation with secondary mobile sweep recommended.";
        }

        const sectorData = {
            sectorKey: key,
            centerLat: sec.centerLat,
            centerLon: sec.centerLon,
            totalStations: total,
            stationNames: sec.stations.map(s => s.name).join(", "),
            fixedCount: sec.fixedCount,
            mobileCount: sec.mobileCount,
            droneCount: sec.droneCount,
            hasDynamicMonitoring: dynamicCount > 0,
            maxAQI: sec.maxAQI,
            status,
            statusClass,
            priority,
            gapReason,
        };

        activeSectors.push(sectorData);
        if (gapReason) {
            coverageGaps.push(sectorData);
        }
    }

    const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    coverageGaps.sort((a, b) => {
        const diff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (diff !== 0) return diff;
        return (b.maxAQI || 0) - (a.maxAQI || 0);
    });

    const dynamicCountTotal = located.filter(s => s.type === "MOBILE" || s.type === "DRONE").length;
    const coverageScore = Math.round((dynamicCountTotal / located.length) * 100);

    return {
        totalStations: located.length,
        coverageScore,
        activeSectors,
        coverageGaps,
        gapCount: coverageGaps.length,
    };
}

/**
 * Intelligent Monitoring Spatial Gap Assessment
 * 
 * Computes spatial isolation distance to the nearest station and prioritizes
 * coverage gaps based on isolation distance combined with surrounding pollution severity.
 * 
 * @param {Array<{lat: number, lon: number, name?: string}>} candidateLocations - Geographic checkpoints
 * @param {Array<object>} stations - Monitored stations
 * @param {object} [options] - Configurations
 */
export function evaluateSpatialCoverageGaps(candidateLocations = [], stations = [], options = {}) {
    if (!Array.isArray(candidateLocations) || candidateLocations.length === 0) return [];
    if (!Array.isArray(stations) || stations.length === 0) return [];

    const locatedStations = stations
        .map(s => {
            const r = s.readings?.[0];
            const lat = r?.latitude ?? s.latitude;
            const lon = r?.longitude ?? s.longitude;
            return {
                id: s.id,
                name: s.name,
                lat,
                lon,
                aqi: Number.isFinite(r?.aqi) ? r.aqi : null,
            };
        })
        .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon));

    if (locatedStations.length === 0) return [];

    const gapAssessments = [];
    const maxThresholdKm = options.maxThresholdKm ?? 15.0;

    for (const loc of candidateLocations) {
        if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) continue;

        // Calculate distances to all existing stations
        let nearestDistKm = Infinity;
        let nearestStation = null;
        let regionalAqiSum = 0;
        let regionalAqiCount = 0;

        for (const st of locatedStations) {
            const dist = calculateDistanceKm(loc.lat, loc.lon, st.lat, st.lon);
            if (dist < nearestDistKm) {
                nearestDistKm = dist;
                nearestStation = st;
            }
            if (dist <= maxThresholdKm && st.aqi !== null) {
                regionalAqiSum += st.aqi;
                regionalAqiCount++;
            }
        }

        const surroundingAvgAQI = regionalAqiCount > 0 ? Math.round(regionalAqiSum / regionalAqiCount) : null;

        // Priority calculation:
        // Distance isolation score (0 - 60 points): higher distance -> bigger gap
        const distanceScore = Math.min(60, Math.round((nearestDistKm / 10.0) * 60));
        // Severity score (0 - 40 points): higher surrounding AQI -> more urgent monitoring
        const severityScore = surroundingAvgAQI ? Math.min(40, Math.round((surroundingAvgAQI / 300) * 40)) : 15;
        const compositePriority = distanceScore + severityScore;

        let priorityLevel = "LOW";
        if (compositePriority >= 70 || nearestDistKm >= 6.0) priorityLevel = "HIGH";
        else if (compositePriority >= 45 || nearestDistKm >= 3.0) priorityLevel = "MEDIUM";

        const reasoning = [];
        if (nearestDistKm >= 5.0) reasoning.push(`Severe isolation: ${nearestDistKm.toFixed(2)} km from nearest station (${nearestStation?.name})`);
        else reasoning.push(`Moderate coverage: ${nearestDistKm.toFixed(2)} km from nearest station (${nearestStation?.name})`);

        if (surroundingAvgAQI && surroundingAvgAQI >= 180) {
            reasoning.push(`Elevated surrounding regional air pollution (~${surroundingAvgAQI} AQI) requires dense local coverage`);
        }

        gapAssessments.push({
            locationName: loc.name || `Checkpoint (${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)})`,
            lat: loc.lat,
            lon: loc.lon,
            nearestStationDistanceKm: Number(nearestDistKm.toFixed(2)),
            nearestStationName: nearestStation?.name || "None",
            surroundingAvgAQI,
            distanceScore,
            severityScore,
            compositePriority,
            priorityLevel,
            reasoning: reasoning.join("; "),
        });
    }

    return gapAssessments.sort((a, b) => b.compositePriority - a.compositePriority);
}
