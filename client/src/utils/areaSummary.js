// Approximate 1 km grid around Delhi. This is a demo comparison, not an official AQI.
export function getAreaSummary(stations, now = Date.now()) {
    const cells = new Map();
    for (const station of stations) {
        const r = station.readings?.[0];
        if (!Number.isFinite(r?.aqi) || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) continue;
        const age = now - new Date(r.recordedAt).getTime();
        if (!Number.isFinite(age) || age < -60000 || age > 3600000) continue;
        const key = `${Math.floor(r.latitude / 0.009)},${Math.floor(r.longitude / 0.0102)}`;
        const cell = cells.get(key) || [];
        cell.push({ name: station.name, aqi: r.aqi });
        cells.set(key, cell);
    }
    return [...cells.entries()].map(([key, readings]) => ({
        key,
        count: readings.length,
        average: Math.round(readings.reduce((sum, r) => sum + r.aqi, 0) / readings.length),
        spread: Math.max(...readings.map(r => r.aqi)) - Math.min(...readings.map(r => r.aqi)),
        names: readings.map(r => r.name).join(", "),
    }));
}
