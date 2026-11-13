export function stationId(value) {
    if (!/^\d+$/.test(String(value))) throw new Error("Invalid station ID");
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new Error("Invalid station ID");
    return id;
}
export function historyOptions(query) {
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
