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
