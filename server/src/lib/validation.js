export function stationId(value) {
    if (!/^\d+$/.test(String(value))) throw new Error("Invalid station ID");
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new Error("Invalid station ID");
    return id;
}
export function historyOptions(query) {
    const limit = query.limit === undefined ? 200 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("Limit must be between 1 and 1000");
    let since;
    if (query.since !== undefined) {
        since = new Date(query.since);
        if (typeof query.since !== "string" || !Number.isFinite(since.getTime())) throw new Error("Invalid start date");
    }
    return { limit, since };
}
