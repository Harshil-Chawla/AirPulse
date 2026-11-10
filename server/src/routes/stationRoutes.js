
import express from "express";
import { fetchStations } from "../controllers/stationController.js";

const router = express.Router();

router.get("/", fetchStations);

export default router;
