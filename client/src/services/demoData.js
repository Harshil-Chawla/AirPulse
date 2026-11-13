// In-memory preview data. Refreshing the page resets the demo.
export function createDemoStore() {
    const stations = ["FIXED", "MOBILE", "DRONE"].map((type, index) => ({
        id: index + 1, name: `Demo ${type.toLowerCase()} station`, type, city: "Delhi",
        latitude: 28.6139 + index * 0.004, longitude: 77.209 + index * 0.004,
    }));
    const history = new Map(stations.map(station => [station.id,
        Array.from({ length: 12 }, (_, index) => ({
            id: station.id * 100 + index, stationId: station.id,
            latitude: station.latitude, longitude: station.longitude,
            aqi: 100 + station.id * 20 + index, pm25: 50 + index, pm10: 90 + index,
            no2: 25, so2: 10, co: 0.8, o3: 30, source: "SIMULATED",
            recordedAt: new Date(Date.now() - index * 60000).toISOString(),
        }))]));
    return {
        stations: async () => structuredClone(stations.map(s => ({ ...s, readings: [history.get(s.id)[0]] }))),
        readings: async id => structuredClone(history.get(Number(id)) || []),
        move: async (id, type) => {
            const station = stations.find(s => s.id === Number(id));
            if (!station || station.type !== type) throw new Error("Select a matching demo station");
            const rows = history.get(station.id);
            const latest = rows[0];
            const step = type === "DRONE" ? 0.004 : 0.002;
            const latitude = Math.max(-90, Math.min(90, latest.latitude + (Math.random() - 0.5) * step));
            const longitude = ((latest.longitude + (Math.random() - 0.5) * step + 540) % 360) - 180;
            const reading = { ...latest, id: latest.id + 1,
                latitude, longitude,
                recordedAt: new Date().toISOString() };
            rows.unshift(reading);
            rows.length = Math.min(rows.length, 200);
            return structuredClone(reading);
        },
    };
}
