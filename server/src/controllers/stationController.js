import { stationId, historyOptions } from "../lib/validation.js";
import { getAllStations, getStationReadings, getStationAggregates, simulateMobileMovement, simulateDroneMovement } from "../services/stationService.js";

const failure = (res, error) => {
    const status = error.message === "Station not found" ? 404 : error.message === "Station type does not match this simulation" ? 400 : 500;
    if (status === 500) console.error(error);
    return res.status(status).json({ success: false, message: status === 500 ? "Unable to complete request" : error.message });
};
function parseId(req, res) {
    try { return stationId(req.params.id); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); return null; }
}
export const fetchStations = async (req, res) => {
    try { const stations = await getAllStations(); res.json({ success: true, count: stations.length, stations }); }
    catch (error) { failure(res, error); }
};
export const fetchStationReadings = async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;
    let options;
    try { options = historyOptions(req.query); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    try { const readings = await getStationReadings(id, options); res.json({ success: true, count: readings.length, readings }); }
    catch (error) { failure(res, error); }
};
export const fetchStationAggregates = async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;
    let options;
    try { options = historyOptions(req.query); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    try { const stats = await getStationAggregates(id, options); res.json({ success: true, stats }); }
    catch (error) { failure(res, error); }
};
const move = (service) => async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;
    try { const reading = await service(id); res.status(201).json({ success: true, reading }); }
    catch (error) { failure(res, error); }
};
export const moveMobileStation = move(simulateMobileMovement);
export const moveDroneStation = move(simulateDroneMovement);
