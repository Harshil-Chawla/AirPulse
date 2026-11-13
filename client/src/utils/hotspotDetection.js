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
        let severity = "Moderate";
        let severityClass = "moderate";

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
