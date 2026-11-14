export function readFavorites(storage) {
    try {
        const value = JSON.parse(storage.getItem("airpulse-favorites") || "[]");
        return Array.isArray(value) ? [...new Set(value.filter(id => Number.isInteger(id) && id > 0))] : [];
    } catch { return []; }
}
export function toggleFavorite(ids, id) {
    return ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
}
