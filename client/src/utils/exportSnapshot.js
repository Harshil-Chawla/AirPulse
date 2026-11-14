import { saveCSV } from "./exportReadings.js";

export function snapshotCSV(stations) {
    const columns = ["stationId", "name", "city", "type", "aqi", "pm25", "pm10", "latitude", "longitude", "source", "recordedAt"];
    const cell = value => `"${String(value ?? "").replace(/^[\s]*[=+@-]/, "' $&").replaceAll('"', '""')}"`;
    const rows = stations.map(s => {
        const reading = s.readings?.[0] || {};
        return { ...reading, stationId: s.id, name: s.name, city: s.city, type: s.type,
            latitude: reading.latitude ?? s.latitude, longitude: reading.longitude ?? s.longitude };
    });
    return [columns.join(","), ...rows.map(row => columns.map(key => cell(row[key])).join(","))].join("\r\n");
}
export function downloadSnapshot(stations) {
    saveCSV(snapshotCSV(stations), "airpulse-station-snapshot.csv");
}
