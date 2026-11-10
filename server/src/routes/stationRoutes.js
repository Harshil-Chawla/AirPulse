
import express from "express";
import {
    fetchStations,
    fetchStationReadings,
} from "../controllers/stationController.js";

const router = express.Router();

router.get("/", fetchStations);
router.get("/:id/readings", fetchStationReadings);


export default router;
