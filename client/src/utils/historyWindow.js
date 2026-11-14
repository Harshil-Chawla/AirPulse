export function historyInWindow(readings, hours, now = Date.now()) {
    if (hours === "all") return readings;
    const duration = Number(hours) * 3600000;
    return readings.filter(row => {
        const timestamp = Date.parse(row.recordedAt);
        return Number.isFinite(timestamp) && timestamp >= now - duration && timestamp <= now;
    });
}
