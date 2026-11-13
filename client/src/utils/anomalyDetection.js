/**
 * Spatiotemporal AQI Anomaly Detection Engine
 * 
 * Combines temporal time-series statistics (rolling z-score & rapid delta) with
 * spatial neighborhood consensus (Haversine distance spatial divergence) to identify
 * genuine micro-climate pollution spikes, localized emissions, and sensor discrepancies.
 */

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(3));
}

export function computeTemporalStats(readings) {
    if (!Array.isArray(readings) || readings.length === 0) {
        return { mean: null, stdDev: null, count: 0, latest: null };
    }

    const validReadings = readings
        .filter(r => r && Number.isFinite(r.aqi) && r.aqi >= 0 && r.aqi <= 500)
        .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

    if (validReadings.length === 0) {
        return { mean: null, stdDev: null, count: 0, latest: null };
    }

    const aqiValues = validReadings.map(r => r.aqi);
    const sum = aqiValues.reduce((acc, val) => acc + val, 0);
    const mean = Number((sum / aqiValues.length).toFixed(1));

    const variance = aqiValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / aqiValues.length;
    const stdDev = Number(Math.sqrt(variance).toFixed(1));

    return {
        mean,
        stdDev,
        count: validReadings.length,
        latest: validReadings[0],
        previous: validReadings[1] || null,
        history: validReadings,
    };
}

export function detectSpatiotemporalAnomalies(stations, stationHistories = {}, now = Date.now()) {
    if (!Array.isArray(stations) || stations.length === 0) {
        return {
            anomalies: [],
            totalChecked: 0,
            activeCount: 0,
            hasCritical: false,
        };
    }

    const anomalies = [];
    const locatedStations = stations.filter(s => {
        const r = s.readings?.[0];
        const lat = r?.latitude ?? s.latitude;
        const lon = r?.longitude ?? s.longitude;
        const aqi = r?.aqi;
        return Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(aqi) && aqi >= 0;
    });

    for (const station of locatedStations) {
        const currentReading = station.readings[0];
        const currentAQI = currentReading.aqi;
        const lat = currentReading.latitude ?? station.latitude;
        const lon = currentReading.longitude ?? station.longitude;
        const recordedTime = new Date(currentReading.recordedAt || now).getTime();
        const ageMinutes = (now - recordedTime) / 60000;

        // Skip stale data (> 2 hours old)
        if (ageMinutes > 120) continue;

        // 1. Temporal Anomaly Check
        const history = stationHistories[station.id] || station.readings || [];
        const temporalStats = computeTemporalStats(history);
        
        let temporalSpike = false;
        let zScore = 0;
        let temporalDelta = 0;

        if (temporalStats.count >= 3 && temporalStats.stdDev !== null) {
            temporalDelta = temporalStats.previous ? currentAQI - temporalStats.previous.aqi : 0;
            if (temporalStats.stdDev > 0) {
                zScore = Number(((currentAQI - temporalStats.mean) / temporalStats.stdDev).toFixed(2));
            }

            // Flag if AQI is > 2.0 standard deviations above historical mean, or jumped >= 35 points in consecutive reading
            if ((zScore >= 2.0 && currentAQI > 120) || (temporalDelta >= 35 && currentAQI > 100)) {
                temporalSpike = true;
            }
        }

        // 2. Spatial Neighborhood Check (within 15 km)
        const neighbors = locatedStations
            .filter(other => other.id !== station.id)
            .map(other => {
                const oReading = other.readings[0];
                const oLat = oReading.latitude ?? other.latitude;
                const oLon = oReading.longitude ?? other.longitude;
                const dist = calculateDistanceKm(lat, lon, oLat, oLon);
                return {
                    station: other,
                    aqi: oReading.aqi,
                    distanceKm: dist,
                };
            })
            .filter(n => n.distanceKm <= 15)
            .sort((a, b) => a.distanceKm - b.distanceKm);

        let spatialOutlier = false;
        let neighborAvgAQI = null;
        let spatialDiff = 0;

        if (neighbors.length > 0) {
            const sumNeighborAQI = neighbors.reduce((acc, n) => acc + n.aqi, 0);
            neighborAvgAQI = Math.round(sumNeighborAQI / neighbors.length);
            spatialDiff = currentAQI - neighborAvgAQI;

            // Spatial outlier: current station is significantly higher than all nearby consensus
            if (spatialDiff >= 35 && currentAQI >= 140) {
                spatialOutlier = true;
            }
        }

        // 3. Physical Decoupling Check (e.g. PM2.5 > PM10 or abrupt physical impossible ratio)
        let ratioAnomaly = false;
        if (Number.isFinite(currentReading.pm25) && Number.isFinite(currentReading.pm10)) {
            if (currentReading.pm25 > currentReading.pm10 * 1.05 && currentReading.pm25 > 20) {
                ratioAnomaly = true;
            }
        }

        // Consolidate into structured anomaly
        if (temporalSpike || spatialOutlier || ratioAnomaly) {
            let anomalyType = "TEMPORAL_SPIKE";
            let severity = "MEDIUM";
            let diagnosis = "";

            if (spatialOutlier && temporalSpike) {
                anomalyType = "LOCAL_HOTSPOT_SPIKE";
                severity = currentAQI > 300 ? "CRITICAL" : "HIGH";
                diagnosis = `Acute localized pollution surge (+${spatialDiff} AQI above spatial consensus of ${neighborAvgAQI}; z-score ${zScore > 0 ? "+" + zScore : zScore}σ). Highly localized emission source detected.`;
            } else if (spatialOutlier) {
                anomalyType = "SPATIAL_OUTLIER";
                severity = spatialDiff >= 50 ? "HIGH" : "MEDIUM";
                diagnosis = `Micro-climate spatial outlier (+${spatialDiff} AQI compared to ${neighbors.length} adjacent stations within 15 km). Suspected point-source pollution or localized trapping.`;
            } else if (temporalSpike) {
                anomalyType = "TEMPORAL_SPIKE";
                severity = zScore >= 2.5 || temporalDelta >= 50 ? "HIGH" : "MEDIUM";
                diagnosis = `Sudden temporal acceleration (jump of +${temporalDelta} AQI; baseline mean was ${temporalStats.mean}). Rapid air quality deterioration.`;
            } else if (ratioAnomaly) {
                anomalyType = "RATIO_INVERSION";
                severity = "LOW";
                diagnosis = `Particulate inversion: PM2.5 (${currentReading.pm25} µg/m³) exceeds PM10 (${currentReading.pm10} µg/m³). Potential sensor calibration drift or high ultrafine organic aerosol event.`;
            }

            anomalies.push({
                id: `anomaly-${station.id}-${recordedTime}`,
                stationId: station.id,
                stationName: station.name,
                stationType: station.type,
                anomalyType,
                severity,
                currentAQI,
                baselineAQI: temporalStats.mean ?? neighborAvgAQI ?? currentAQI,
                delta: temporalDelta || spatialDiff,
                zScore: zScore || null,
                spatialDiff,
                neighborCount: neighbors.length,
                neighborAvgAQI,
                latitude: lat,
                longitude: lon,
                recordedAt: currentReading.recordedAt,
                diagnosis,
                supportingMeasurements: {
                    pm25: currentReading.pm25 ?? null,
                    pm10: currentReading.pm10 ?? null,
                    no2: currentReading.no2 ?? null,
                    dominantPollutant: currentReading.dominant ?? "PM2.5",
                },
            });
        }
    }

    // Sort by severity (CRITICAL > HIGH > MEDIUM > LOW) then by currentAQI descending
    const severityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    anomalies.sort((a, b) => {
        const diff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
        if (diff !== 0) return diff;
        return b.currentAQI - a.currentAQI;
    });

    return {
        anomalies,
        totalChecked: locatedStations.length,
        activeCount: anomalies.length,
        hasCritical: anomalies.some(a => a.severity === "CRITICAL"),
    };
}
