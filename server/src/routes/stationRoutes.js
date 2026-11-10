
import express from "express";
import {
    fetchStations,
    fetchStationReadings,
  moveMobileStation,
} from "../controllers/stationController.js";

const router = express.Router();

router.get("/", fetchStations);
router.get("/:id/readings", fetchStationReadings);
router.post("/:id/simulate-movement", moveMobileStation);

export default router;
