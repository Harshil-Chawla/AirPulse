
import { historyOptions } from "../lib/validation.js";
import {
    getAllStations,
    getStationReadings,
    simulateMobileMovement,
    simulateDroneMovement
} from "../services/stationService.js";


export const fetchStations = async (req, res) => {
    try {
        const stations = await getAllStations();

        res.status(200).json({
            success: true,
            count: stations.length,
            stations,
        });
    } catch (error) {
        console.error("Error fetching stations:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch stations",
        });
    }
};


export const fetchStationReadings = async (req, res) => {
    try {
        const stationId = Number(req.params.id);

        // Validate the station ID
        if (!Number.isInteger(stationId) || stationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid station ID",
            });
        }

        let options;
        try { options = historyOptions(req.query); }
        catch (error) { return res.status(400).json({ success: false, message: error.message }); }
        const readings = await getStationReadings(stationId, options);

        res.status(200).json({
            success: true,
            count: readings.length,
            readings,
        });
    } catch (error) {
        console.error("Error fetching station readings:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch station readings",
        });
    }
};

export const moveMobileStation = async (req, res) => {
  try {
    const stationId = Number(req.params.id);

    if (!Number.isInteger(stationId) || stationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid station ID",
      });
    }

    const reading = await simulateMobileMovement(
      stationId, req.path.endsWith("simulate-drone-movement") ? "DRONE" : "MOBILE"
    );

    return res.status(201).json({
      success: true,
      message: "Simulated movement recorded",
      reading,
    });
  } catch (error) {
    const status = error.message === "Station not found" ? 404 : 400;

    return res.status(status).json({
      success: false,
      message: error.message,
    });
  }
};

export const moveDroneStation = async (req, res) => {
    try {
        const stationId = Number(req.params.id);

        if (!Number.isInteger(stationId) || stationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid station ID",
            });
        }

        const reading = await simulateDroneMovement(stationId);

        return res.status(201).json({
            success: true,
            message: "Simulated drone movement recorded",
            reading,
        });
    } catch (error) {
        const status = error.message === "Station not found" ? 404 : 400;

        return res.status(status).json({
            success: false,
            message: error.message,
        });
    }
};