
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


export const simulateMobileMovement = async (stationId) => {
  // Find the station and its latest reading
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: {
      readings: {
        orderBy: { recordedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!station) {
    throw new Error("Station not found");
  }

  if (station.type !== "MOBILE") {
    throw new Error("Only mobile stations can move");
  }

  const latestReading = station.readings[0];

  // Use the latest recorded location as the starting point
  const currentLatitude =
    latestReading?.latitude ?? station.latitude;

  const currentLongitude =
    latestReading?.longitude ?? station.longitude;

  // Generate a small random movement
  const latitude = currentLatitude + (Math.random() - 0.5) * 0.002;
  const longitude = currentLongitude + (Math.random() - 0.5) * 0.002;

  // Slightly vary pollutant values to simulate new measurements
  const vary = (value) =>
    value == null
      ? null
      : Math.max(0, Number((value * (0.95 + Math.random() * 0.1)).toFixed(1)));

  const aqi = latestReading?.aqi ?? 0;
  const newAQI = Math.max(
    0,
    Math.min(500, Math.round(aqi + (Math.random() - 0.5) * 10))
  );

  // Save the new location and reading in PostgreSQL
  const newReading = await prisma.reading.create({
    data: {
      stationId: station.id,
      latitude,
      longitude,
      pm25: vary(latestReading?.pm25),
      pm10: vary(latestReading?.pm10),
      no2: vary(latestReading?.no2),
      so2: vary(latestReading?.so2),
      co: vary(latestReading?.co),
      o3: vary(latestReading?.o3),
      aqi: newAQI,
      source: "SIMULATED",
    },
  });

  return newReading;
};

