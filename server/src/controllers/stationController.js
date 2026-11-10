
import { getAllStations } from "../services/stationService.js";

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
