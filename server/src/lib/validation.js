export function stationId(value) {
    if (!/^\d+$/.test(String(value))) throw new Error("Invalid station ID");
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new Error("Invalid station ID");
    return id;
}

export function historyOptions(query = {}) {
    let limit = 200;
    if (query.limit !== undefined) {
        if (!/^\d+$/.test(String(query.limit))) throw new Error("Limit must be between 1 and 1000");
        limit = Number(query.limit);
        if (limit < 1 || limit > 1000) throw new Error("Limit must be between 1 and 1000");
    }
    let since;
    if (query.since !== undefined) {
        if (typeof query.since !== "string") throw new Error("Invalid start date");
        since = new Date(query.since);
        if (!Number.isFinite(since.getTime())) throw new Error("Invalid start date");
        if (since.getTime() > Date.now() + 60000) throw new Error("Start date cannot be in the future");
    }
    return { limit, since };
}

const VALID_SOURCES = new Set(["CPCB", "OPENAQ", "OPEN_METEO", "SIMULATED"]);
const POLLUTANTS = ["pm25", "pm10", "no2", "so2", "co", "o3"];

/**
 * Normalizes a pollutant numeric reading:
 * - Rejects negative values (e.g. sensor error flags like -999, -1) -> returns null
 * - Filters NaN, non-finite or non-numeric values -> returns null
 * - Rounds valid non-negative measurements to 1 decimal place
 */
export function normalizePollutantValue(value) {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num * 10) / 10;
}

/**
 * Centralized reading validation and normalization pipeline.
 * Ensures data integrity, physical feasibility constraints (e.g., PM2.5 <= PM10),
 * coordinate bounding, and timestamp freshness.
 */
export function normalizeReading(raw = {}) {
    if (typeof raw !== "object" || raw === null) {
        throw new Error("Reading payload must be an object");
    }

    // Station ID validation
    const id = stationId(raw.stationId);

    // Coordinates validation and bounded normalization
    const lat = Number(raw.latitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw new Error("Latitude must be a valid number between -90 and 90");
    }

    let lon = Number(raw.longitude);
    if (!Number.isFinite(lon)) {
        throw new Error("Longitude must be a valid finite number");
    }
    // Normalize longitude to [-180, 180)
    lon = ((lon + 180) % 360 + 360) % 360 - 180;

    // AQI validation & clamping [0, 500]
    let aqi = null;
    if (raw.aqi !== null && raw.aqi !== undefined && raw.aqi !== "") {
        const aqiNum = Number(raw.aqi);
        if (Number.isFinite(aqiNum) && aqiNum >= 0) {
            aqi = Math.max(0, Math.min(500, Math.round(aqiNum)));
        }
    }

    // Normalize pollutants
    const pollutants = {};
    for (const p of POLLUTANTS) {
        pollutants[p] = normalizePollutantValue(raw[p]);
    }

    // Physical constraint: Atmospheric PM2.5 cannot exceed PM10.
    // If sensor drift causes pm25 > pm10, calibrate pm10 to at least pm25.
    if (pollutants.pm25 !== null && pollutants.pm10 !== null && pollutants.pm25 > pollutants.pm10) {
        pollutants.pm10 = pollutants.pm25;
    }

    // Source validation
    const source = raw.source || "SIMULATED";
    if (!VALID_SOURCES.has(source)) {
        throw new Error(`Invalid data source: ${source}`);
    }

    // Timestamp validation
    let recordedAt = new Date();
    if (raw.recordedAt !== undefined && raw.recordedAt !== null) {
        const parsed = new Date(raw.recordedAt);
        if (!Number.isFinite(parsed.getTime())) {
            throw new Error("Invalid recordedAt timestamp");
        }
        if (parsed.getTime() > Date.now() + 60000) {
            throw new Error("recordedAt cannot be more than 1 minute in the future");
        }
        recordedAt = parsed;
    }

    return {
        stationId: id,
        latitude: Math.round(lat * 1000000) / 1000000,
        longitude: Math.round(lon * 1000000) / 1000000,
        ...pollutants,
        aqi,
        source,
        recordedAt,
    };
}

/**
 * Calculates data freshness category and age for a timestamp
 */
export function getDataFreshness(recordedAt, now = new Date()) {
    if (!recordedAt) return null;
    const date = new Date(recordedAt);
    if (!Number.isFinite(date.getTime())) return null;

    const ageMs = Math.max(0, now.getTime() - date.getTime());
    const ageMinutes = Math.round(ageMs / 60000);

    let status = "fresh";
    if (ageMinutes > 120) {
        status = "expired";
    } else if (ageMinutes > 30) {
        status = "stale";
    }

    return {
        ageMs,
        ageMinutes,
        status,
        recordedAt: date.toISOString(),
    };
}

/**
 * Efficiently computes aggregated statistical summaries across a sequence of readings
 */
export function aggregateReadings(readings = [], now = new Date()) {
    if (!Array.isArray(readings) || readings.length === 0) {
        return {
            count: 0,
            latestRecordedAt: null,
            freshness: null,
            summary: {
                aqi: null,
                pm25: null,
                pm10: null,
                no2: null,
                so2: null,
                co: null,
                o3: null,
            },
        };
    }

    const fields = ["aqi", ...POLLUTANTS];
    const stats = {};
    for (const f of fields) {
        stats[f] = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
    }

    let latestDate = null;
    let earliestDate = null;

    for (const r of readings) {
        if (r.recordedAt) {
            const d = new Date(r.recordedAt);
            if (Number.isFinite(d.getTime())) {
                if (!latestDate || d > latestDate) latestDate = d;
                if (!earliestDate || d < earliestDate) earliestDate = d;
            }
        }

        for (const f of fields) {
            const val = r[f];
            if (val !== null && val !== undefined && Number.isFinite(Number(val))) {
                const num = Number(val);
                if (num < stats[f].min) stats[f].min = num;
                if (num > stats[f].max) stats[f].max = num;
                stats[f].sum += num;
                stats[f].count += 1;
            }
        }
    }

    const summary = {};
    for (const f of fields) {
        if (stats[f].count === 0) {
            summary[f] = null;
        } else {
            summary[f] = {
                min: stats[f].min,
                max: stats[f].max,
                avg: Math.round((stats[f].sum / stats[f].count) * 10) / 10,
                count: stats[f].count,
            };
        }
    }

    return {
        count: readings.length,
        timeRange: {
            earliest: earliestDate ? earliestDate.toISOString() : null,
            latest: latestDate ? latestDate.toISOString() : null,
        },
        freshness: latestDate ? getDataFreshness(latestDate, now) : null,
        summary,
    };
}
