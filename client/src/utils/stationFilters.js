export function filterStations(stations, { type = "ALL", search = "", sort = "name" } = {}) {
    const query = search.trim().toLowerCase();
    return stations.filter(s => (type === "ALL" || s.type === type) &&
        `${s.name} ${s.city}`.toLowerCase().includes(query)).sort((a, b) => {
        if (sort === "aqi") {
            const first = a.readings?.[0]?.aqi;
            const second = b.readings?.[0]?.aqi;
            if (Number.isFinite(first) !== Number.isFinite(second)) return Number.isFinite(first) ? -1 : 1;
            if (Number.isFinite(first) && first !== second) return second - first;
        }
        return a.name.localeCompare(b.name) || a.id - b.id;
    });
}
