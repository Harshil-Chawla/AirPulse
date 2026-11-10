
import {
    getAllStations,
    getStationReadings,
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

        const readings = await getStationReadings(stationId);

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
