
import express from "express";
import {
    fetchStations,
    fetchStationReadings,
    moveMobileStation,
    moveDroneStation
} from "../controllers/stationController.js";

const router = express.Router();
router.use((req, res, next) => {
    if (req.method === "POST" && process.env.ENABLE_SIMULATION !== "true") {
        return res.status(403).json({ success: false, message: "Simulation is disabled" });
    }
    next();
});

router.get("/", fetchStations);
router.get("/:id/readings", fetchStationReadings);
router.post("/:id/simulate-movement", moveMobileStation);
router.post("/:id/simulate-drone-movement", moveDroneStation);

export default router;
