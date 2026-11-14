/**
 * Intelligent Historical AQI Trend & Insight Analysis
 * 
 * Analyzes historical reading time series to:
 * - Detect trend direction: IMPROVING, DETERIORATING, or STABLE
 * - Calculate percentage change and absolute delta over valid time window
 * - Identify min, max, average, and peak deterioration periods
 * - Handle missing readings, irregular timestamps, and insufficient history cleanly
 */

export function analyzeAQITrend(readings, options = {}) {
    if (!Array.isArray(readings) || readings.length === 0) {
        return {
            status: "INSUFFICIENT_DATA",
            trend: "UNKNOWN",
            percentageChange: null,
            absoluteChange: null,
            summary: null,
            extrema: null,
            dataPoints: 0,
        };
    }

    // Filter valid positive AQI and valid timestamps
    const cleanReadings = readings
        .filter(r => r && r.aqi !== null && r.aqi !== undefined && r.aqi !== "" && Number.isFinite(Number(r.aqi)) && Number(r.aqi) >= 0 && r.recordedAt)
        .map(r => ({
            aqi: Math.round(Number(r.aqi)),
            timestamp: new Date(r.recordedAt).getTime(),
            recordedAt: r.recordedAt,
        }))
        .filter(r => Number.isFinite(r.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp); // Chronological: oldest to newest

    if (cleanReadings.length < 2) {
        return {
            status: "INSUFFICIENT_DATA",
            trend: "STABLE",
            percentageChange: 0,
            absoluteChange: 0,
            summary: cleanReadings.length === 1 ? { current: cleanReadings[0].aqi } : null,
            extrema: cleanReadings.length === 1 ? { min: cleanReadings[0], max: cleanReadings[0] } : null,
            dataPoints: cleanReadings.length,
        };
    }

    const first = cleanReadings[0];
    const latest = cleanReadings[cleanReadings.length - 1];

    let minReading = cleanReadings[0];
    let maxReading = cleanReadings[0];
    let sum = 0;

    for (const r of cleanReadings) {
        sum += r.aqi;
        if (r.aqi < minReading.aqi) minReading = r;
        if (r.aqi > maxReading.aqi) maxReading = r;
    }

    const average = Math.round((sum / cleanReadings.length) * 10) / 10;
    const absoluteChange = latest.aqi - first.aqi;

    // In AQI: lower is better!
    // If AQI decreases -> air quality is IMPROVING
    // If AQI increases -> air quality is DETERIORATING
    let percentageChange = 0;
    if (first.aqi > 0) {
        percentageChange = Math.round(((latest.aqi - first.aqi) / first.aqi) * 1000) / 10;
    }

    // Stable threshold: change within +/- 5% or +/- 5 AQI points
    let trend = "STABLE";
    const deltaThreshold = options.deltaThreshold ?? 5;
    const percentThreshold = options.percentThreshold ?? 5.0;

    if (Math.abs(absoluteChange) >= deltaThreshold && Math.abs(percentageChange) >= percentThreshold) {
        trend = absoluteChange < 0 ? "IMPROVING" : "DETERIORATING";
    }

    // Identify peak period (highest 3-reading window if >= 4 readings)
    let peakPeriod = null;
    if (cleanReadings.length >= 4) {
        let maxWindowSum = -1;
        let maxWindowIdx = 0;
        for (let i = 0; i <= cleanReadings.length - 3; i++) {
            const wSum = cleanReadings[i].aqi + cleanReadings[i + 1].aqi + cleanReadings[i + 2].aqi;
            if (wSum > maxWindowSum) {
                maxWindowSum = wSum;
                maxWindowIdx = i;
            }
        }
        peakPeriod = {
            start: cleanReadings[maxWindowIdx].recordedAt,
            end: cleanReadings[maxWindowIdx + 2].recordedAt,
            averageAQI: Math.round((maxWindowSum / 3) * 10) / 10,
        };
    }

    return {
        status: "OPTIMAL",
        trend,
        direction: absoluteChange < 0 ? "DOWN" : absoluteChange > 0 ? "UP" : "FLAT",
        absoluteChange,
        percentageChange,
        extrema: {
            min: { aqi: minReading.aqi, recordedAt: minReading.recordedAt },
            max: { aqi: maxReading.aqi, recordedAt: maxReading.recordedAt },
            spread: maxReading.aqi - minReading.aqi,
        },
        summary: {
            first: first.aqi,
            latest: latest.aqi,
            average,
            peakPeriod,
            durationHours: Math.round(((latest.timestamp - first.timestamp) / 3600000) * 10) / 10,
        },
        dataPoints: cleanReadings.length,
    };
}
