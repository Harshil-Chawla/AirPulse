import { createDemoStore } from "./demoData";
export const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
const demo = demoMode ? createDemoStore() : null;
const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function request(path, options) {
    const signal = options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000);
    const response = await fetch(`${API_URL}${path}`, { ...options, signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(data?.message || `Request failed (${response.status})`);
    }
    if (!data?.success) throw new Error("Unexpected server response");
    return data;
}

export const fetchStations = async () => demo ? demo.stations() : (await request("/stations")).stations;
export const fetchStationReadings = async (id, signal) =>
    demo ? demo.readings(id) : (await request(`/stations/${id}/readings?limit=200`, { signal })).readings;
export const simulateStationMovement = async (id) =>
    demo ? demo.move(id, "MOBILE") : (await request(`/stations/${id}/simulate-movement`, { method: "POST" })).reading;
export const simulateDroneMovement = async (id) =>
    demo ? demo.move(id, "DRONE") : (await request(`/stations/${id}/simulate-drone-movement`, { method: "POST" })).reading;
