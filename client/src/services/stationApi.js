const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function request(path, options) {
    const response = await fetch(`${API_URL}${path}`, options);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(data?.message || `Request failed (${response.status})`);
    }
    if (!data?.success) throw new Error("Unexpected server response");
    return data;
}

export const fetchStations = async () => (await request("/stations")).stations;
export const fetchStationReadings = async (id, signal) =>
    (await request(`/stations/${id}/readings?limit=200`, { signal })).readings;
export const simulateStationMovement = async (id) =>
    (await request(`/stations/${id}/simulate-movement`, { method: "POST" })).reading;
export const simulateDroneMovement = async (id) =>
    (await request(`/stations/${id}/simulate-drone-movement`, { method: "POST" })).reading;
