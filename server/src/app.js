
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import stationRoutes from "./routes/stationRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/stations", stationRoutes);

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

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const invalid = error.type === "entity.parse.failed";
    if (!invalid) console.error(error);
    res.status(invalid ? 400 : 500).json({ success: false, message: invalid ? "Invalid JSON" : "Server error" });
});
export default app;
