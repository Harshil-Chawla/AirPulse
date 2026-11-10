
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
