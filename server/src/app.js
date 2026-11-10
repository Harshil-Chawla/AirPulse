
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "AirPulse server is running",
    });
});

app.get("/api/db-health", async (req, res) => {
    try {
        await prisma.$connect();

        const stations = await prisma.station.count();

        res.json({
            success: true,
            message: "Database connected successfully",
            stationCount: stations,
        });
    } catch (error) {
        console.error("Database connection error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed",
        });
    }
});

export default app;
