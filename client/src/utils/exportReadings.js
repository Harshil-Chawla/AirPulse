export function readingsToCSV(readings) {
    const columns = ["recordedAt", "latitude", "longitude", "aqi", "pm25", "pm10", "no2", "so2", "co", "o3", "source"];
    const escape = value => `"${String(value ?? "").replace(/^[=+@-]/, "' $&").replaceAll('"', '""')}"`;
    return [columns.join(","), ...readings.map(r => columns.map(key => escape(r[key])).join(","))].join("\r\n");
}

export function saveCSV(csv, filename) {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReadings(readings, stationId) {
    saveCSV(readingsToCSV(readings), `station-${stationId}-readings.csv`);
}
