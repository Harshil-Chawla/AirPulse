import { getDominantPollutant } from "./hotspotDetection.js";

export function analyzePollutantIntelligence(stations) {
    if (!Array.isArray(stations) || stations.length === 0) {
        return {
            primaryDriver: "Unavailable",
            driverPercentage: 0,
            pmRatio: null,
            pmRatioDiagnosis: "No PM readings available.",
            dominantBreakdown: {},
            totalReadings: 0,
        };
    }

    const breakdown = {};
    let total = 0;
    let pm25Sum = 0;
    let pm10Sum = 0;
    let pmCount = 0;

    for (const station of stations) {
        const r = station.readings?.[0];
        if (!r) continue;

        const dominant = getDominantPollutant(r);
        if (dominant) {
            breakdown[dominant] = (breakdown[dominant] || 0) + 1;
            total++;
        }

        if (Number.isFinite(r.pm25) && Number.isFinite(r.pm10) && r.pm10 > 0 && r.pm25 >= 0) {
            pm25Sum += r.pm25;
            pm10Sum += r.pm10;
            pmCount++;
        }
    }

    let primaryDriver = "None";
    let maxCount = 0;
    for (const [key, count] of Object.entries(breakdown)) {
        if (count > maxCount) {
            maxCount = count;
            primaryDriver = key;
        }
    }

    const driverPercentage = total > 0 ? Math.round((maxCount / total) * 100) : 0;

    let pmRatio = null;
    let pmRatioDiagnosis = "Insufficient PM data for ratio calculation.";

    if (pmCount > 0 && pm10Sum > 0) {
        pmRatio = Number((pm25Sum / pm10Sum).toFixed(2));
        if (pmRatio >= 0.6) {
            pmRatioDiagnosis = `Fine particle dominance (PM2.5/PM10 = ${pmRatio}). Characteristic of vehicular combustion and aerosol trapping.`;
        } else {
            pmRatioDiagnosis = `Coarse dust dominance (PM2.5/PM10 = ${pmRatio}). Characteristic of road dust re-suspension and construction.`;
        }
    }

    return {
        primaryDriver,
        driverPercentage,
        pmRatio,
        pmRatioDiagnosis,
        dominantBreakdown: breakdown,
        totalReadings: total,
    };
}
