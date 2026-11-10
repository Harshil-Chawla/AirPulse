
import { prisma } from "../lib/prisma.js";

export const getAllStations = async () => {
    const stations = await prisma.station.findMany({
        include: {
            readings: {
                orderBy: {
                    recordedAt: "desc",
                },
                take: 1,
            },
        },
    });

    return stations;
};

export const getStationReadings = async (stationId) => {
    const readings = await prisma.reading.findMany({
        where: {
            stationId: stationId,
        },
        orderBy: {
            recordedAt: "desc",
        },
    });

    return readings;
};
