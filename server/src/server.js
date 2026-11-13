import "dotenv/config";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in server/.env before starting");
try {
    await prisma.$connect();
    const server = app.listen(port, () => console.log(`AirPulse API: http://localhost:${port}`));
    server.on("error", async error => { console.error(error.message); await prisma.$disconnect(); process.exitCode = 1; });
    const shutdown = () => {
        const timeout = setTimeout(() => process.exit(1), 10000);
        timeout.unref();
        server.close(async () => { await prisma.$disconnect(); clearTimeout(timeout); });
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
} catch (error) {
    console.error("Database startup failed:", error.message);
    await prisma.$disconnect();
    process.exitCode = 1;
}
