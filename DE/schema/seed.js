
import { prisma } from "../src/lib/prisma.js";

const stations = [
    {
        name: "Demo Fixed Station - Delhi",
        type: "FIXED",
        city: "Delhi",
        latitude: 28.6139,
        longitude: 77.2090,
        reading: {
            pm25: 85,
            pm10: 145,
            no2: 32,
            so2: 12,
            co: 0.8,
            o3: 28,
            aqi: 165,
            latitude: 28.6139,
            longitude: 77.2090,
            source: "SIMULATED",
        },
    },
    {
        name: "Demo Mobile Station - Delhi",
        type: "MOBILE",
        city: "Delhi",
        latitude: 28.6200,
        longitude: 77.2150,
        reading: {
            pm25: 110,
            pm10: 180,
            no2: 40,
            so2: 15,
            co: 1.1,
            o3: 35,
            aqi: 190,
            latitude: 28.6200,
            longitude: 77.2150,
            source: "SIMULATED",
        },
    },
    {
        name: "Demo Drone Station - Delhi",
        type: "DRONE",
        city: "Delhi",
        latitude: 28.6300,
        longitude: 77.2200,
        reading: {
            pm25: 65,
            pm10: 120,
            no2: 25,
            so2: 10,
            co: 0.6,
            o3: 22,
            aqi: 135,
            latitude: 28.6300,
            longitude: 77.2200,
            source: "SIMULATED",
        },
    },
];

async function main() {
    for (const station of stations) {
        const existing = await prisma.station.findFirst({
            where: { name: station.name },
        });

        if (existing) {
            console.log(`Already exists: ${station.name}`);
            continue;
        }

        const created = await prisma.station.create({
            data: {
                name: station.name,
                type: station.type,
                city: station.city,
                latitude: station.latitude,
                longitude: station.longitude,
                readings: {
                    create: station.reading,
                },
            },
        });

        console.log(`Created: ${created.name}`);
    }
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
