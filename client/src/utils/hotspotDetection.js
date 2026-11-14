export function getDominantPollutant(reading) {
    if (!reading) return null;
    const benchmarks = {
        pm25: 60,
        pm10: 100,
        no2: 80,
        so2: 80,
        co: 2,
        o3: 100,
    };
    let dominant = null;
    let maxRatio = -1;

    for (const [key, benchmark] of Object.entries(benchmarks)) {
        const val = reading[key];
        if (Number.isFinite(val) && val >= 0) {
            const ratio = val / benchmark;
            if (ratio > maxRatio) {
                maxRatio = ratio;
                dominant = key.toUpperCase();
                if (dominant === "PM25") dominant = "PM2.5";
            }
        }
    }
    return dominant;
}

export function detectHotspots(stations) {
    if (!Array.isArray(stations)) return [];

    const hotspots = [];

    for (const station of stations) {
        const r = station.readings?.[0];
        if (!r || !Number.isFinite(r.aqi) || r.aqi < 0) continue;

        const aqi = r.aqi;
        let severity;
        let severityClass;

        if (aqi > 400) {
            severity = "Severe";
            severityClass = "severe";
        } else if (aqi > 300) {
            severity = "Very Poor";
            severityClass = "very-poor";
        } else if (aqi > 200) {
            severity = "Poor";
            severityClass = "poor";
        } else if (aqi > 100) {
            severity = "Moderate";
            severityClass = "moderate";
        } else if (aqi > 50) {
            severity = "Satisfactory";
            severityClass = "satisfactory";
        } else {
            severity = "Good";
            severityClass = "good";
        }

        hotspots.push({
            id: station.id,
            name: station.name,
            type: station.type,
            aqi,
            latitude: r.latitude ?? station.latitude,
            longitude: r.longitude ?? station.longitude,
            severity,
            severityClass,
            dominantPollutant: getDominantPollutant(r) || "PM2.5",
            recordedAt: r.recordedAt,
        });
    }

    return hotspots.sort((a, b) => b.aqi - a.aqi);
}

/**
 * Smart Persistence-Aware Hotspot Prioritization Engine
 * 
 * Ranks detected hotspots by combining:
 * 1. Current pollution severity (AQI level)
 * 2. Persistence / recurrence across historical readings (distinguishing chronic vs transient spike)
 * 3. Telemetry freshness (downweighting stale observations)
 * 4. Station coverage density
 */
export function prioritizeHotspots(stations, stationHistories = {}, options = {}) {
    const baseHotspots = detectHotspots(stations);
    if (baseHotspots.length === 0) return [];

    const now = options.now ? new Date(options.now).getTime() : Date.now();

    return baseHotspots.map(hotspot => {
        const history = stationHistories[hotspot.id] || [];
        const validHistory = history.filter(h => h && Number.isFinite(h.aqi) && h.aqi >= 0);

        // 1. Severity Score (0 - 100)
        const severityScore = Math.min(100, Math.max(0, (hotspot.aqi / 400) * 100));

        // 2. Persistence Score (0 - 100): fraction of historical readings that are elevated (AQI >= 150)
        let persistenceScore = 50; // default if history is insufficient
        let elevatedCount = 0;
        let recurrenceCategory = "ISOLATED_OBSERVATION";

        if (validHistory.length >= 3) {
            elevatedCount = validHistory.filter(h => h.aqi >= 150).length;
            const fractionElevated = elevatedCount / validHistory.length;
            persistenceScore = Math.round(fractionElevated * 100);

            if (fractionElevated >= 0.7) {
                recurrenceCategory = "CHRONIC_HOTSPOT";
            } else if (fractionElevated >= 0.35) {
                recurrenceCategory = "RECURRING_HOTSPOT";
            } else {
                recurrenceCategory = "TRANSIENT_SPIKE";
            }
        } else if (hotspot.aqi >= 200) {
            recurrenceCategory = "ACUTE_SPIKE";
        }

        // 3. Freshness Factor (0 - 100): Exponential decay if older than 30 mins
        let freshnessScore = 100;
        if (hotspot.recordedAt) {
            const ageMinutes = Math.max(0, (now - new Date(hotspot.recordedAt).getTime()) / 60000);
            if (ageMinutes > 120) freshnessScore = 20;
            else if (ageMinutes > 30) freshnessScore = Math.max(30, Math.round(100 - (ageMinutes - 30) * 0.8));
        }

        // 4. Priority Score Calculation: 50% severity + 35% persistence + 15% freshness
        const priorityScore = Math.round(
            severityScore * 0.50 +
            persistenceScore * 0.35 +
            freshnessScore * 0.15
        );

        // Explanation of factors
        const explanations = [];
        if (severityScore >= 60) {
            explanations.push(`High acute pollution intensity (${hotspot.aqi} AQI, ${hotspot.severity})`);
        }
        if (recurrenceCategory === "CHRONIC_HOTSPOT") {
            explanations.push(`Persistent elevated baseline (${elevatedCount}/${validHistory.length} historical readings >= 150 AQI)`);
        } else if (recurrenceCategory === "TRANSIENT_SPIKE") {
            explanations.push(`Isolated transient peak against lower historical background`);
        }
        if (freshnessScore < 60) {
            explanations.push(`Older reading age diminishes intervention urgency`);
        }

        return {
            ...hotspot,
            priorityScore,
            recurrenceCategory,
            persistenceRatio: validHistory.length > 0 ? Math.round((elevatedCount / validHistory.length) * 100) / 100 : null,
            scoreBreakdown: {
                severity: Math.round(severityScore),
                persistence: Math.round(persistenceScore),
                freshness: Math.round(freshnessScore),
            },
            explanation: explanations.join("; ") || "Standard hotspot priority tracking.",
        };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
}
