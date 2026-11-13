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

export const getStationReadings = async (stationId, { limit = 200, since } = {}) => {
    if (!await prisma.station.findUnique({ where: { id: stationId } })) throw new Error("Station not found");
    const readings = await prisma.reading.findMany({
        take: limit,
        where: {
            stationId: stationId,
            ...(since ? { recordedAt: { gte: since } } : {}),
        },
        orderBy: {
            recordedAt: "desc",
        },
    });

    return readings;
};

export const getStationAggregates = async (stationId, { limit = 1000, since } = {}) => {
    if (!await prisma.station.findUnique({ where: { id: stationId } })) throw new Error("Station not found");
    const readings = await prisma.reading.findMany({
        take: limit,
        where: {
            stationId: stationId,
            ...(since ? { recordedAt: { gte: since } } : {}),
        },
        orderBy: {
            recordedAt: "desc",
        },
    });

    const POLLUTANTS = ["pm25", "pm10", "no2", "so2", "co", "o3"];
    const fields = ["aqi", ...POLLUTANTS];
    const stats = {};
    for (const f of fields) {
        stats[f] = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
    }

    let latestDate = null;
    let earliestDate = null;

    for (const r of readings) {
        if (r.recordedAt) {
            const d = new Date(r.recordedAt);
            if (Number.isFinite(d.getTime())) {
                if (!latestDate || d > latestDate) latestDate = d;
                if (!earliestDate || d < earliestDate) earliestDate = d;
            }
        }

        for (const f of fields) {
            const val = r[f];
            if (val !== null && val !== undefined && Number.isFinite(Number(val))) {
                const num = Number(val);
                if (num < stats[f].min) stats[f].min = num;
                if (num > stats[f].max) stats[f].max = num;
                stats[f].sum += num;
                stats[f].count += 1;
            }
        }
    }

    const summary = {};
    for (const f of fields) {
        if (stats[f].count === 0) {
            summary[f] = null;
        } else {
            summary[f] = {
                min: stats[f].min,
                max: stats[f].max,
                avg: Math.round((stats[f].sum / stats[f].count) * 10) / 10,
                count: stats[f].count,
            };
        }
    }

    const freshness = latestDate ? (() => {
        const ageMs = Math.max(0, Date.now() - latestDate.getTime());
        const ageMinutes = Math.round(ageMs / 60000);
        let status = "fresh";
        if (ageMinutes > 120) status = "expired";
        else if (ageMinutes > 30) status = "stale";
        return { ageMs, ageMinutes, status, recordedAt: latestDate.toISOString() };
    })() : null;

    return {
        count: readings.length,
        timeRange: {
            earliest: earliestDate ? earliestDate.toISOString() : null,
            latest: latestDate ? latestDate.toISOString() : null,
        },
        freshness,
        summary,
    };
};

export const simulateMobileMovement = async (stationId, stationType = "MOBILE") => {
  // Query station and baseline reading concurrently to eliminate DB waterfall latency
  const [station, baselineReading] = await Promise.all([
    prisma.station.findUnique({
      where: { id: stationId },
      include: {
        readings: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.reading.findFirst({
      where: {
        stationId: stationId,
      },
      orderBy: {
        recordedAt: "asc",
      },
    }),
  ]);

  if (!station) {
    throw new Error("Station not found");
  }

  if (station.type !== stationType) {
    throw new Error("Station type does not match this simulation");
  }

  const latestReading = station.readings?.[0];

  // Use the latest recorded location as the starting point
  const currentLatitude =
    latestReading?.latitude ?? station.latitude;

  const currentLongitude =
    latestReading?.longitude ?? station.longitude;

  // Generate a small random movement
  const step = stationType === "DRONE" ? 0.004 : 0.002;
  const latitude = Math.max(-90, Math.min(90, currentLatitude + (Math.random() - 0.5) * step));
  const longitude = ((currentLongitude + (Math.random() - 0.5) * step + 540) % 360) - 180;

  // Slightly vary pollutant values to simulate new measurements
  const vary = (value) =>
      value == null
          ? null
          : Math.max(
              0,
              Number(
                  (value * (0.95 + Math.random() * 0.1)).toFixed(1)
              )
  );

  const aqi = baselineReading?.aqi ?? latestReading?.aqi ?? null;
  const newAQI = aqi === null ? null : Math.max(
      0,
      Math.min(500, Math.round(aqi + (Math.random() - 0.5) * 10))
  );

  // Normalize and sanitize pollutants
  let pm25 = vary(baselineReading?.pm25);
  let pm10 = vary(baselineReading?.pm10);
  // Physical sanity check: PM2.5 cannot exceed PM10 in ambient air
  if (pm25 !== null && pm10 !== null && pm25 > pm10) {
      pm10 = pm25;
  }

  // Save the new location and normalized reading in PostgreSQL
  const newReading = await prisma.reading.create({
    data: {
      stationId: station.id,
      latitude: Math.round(latitude * 1000000) / 1000000,
      longitude: Math.round(longitude * 1000000) / 1000000,
      pm25,
      pm10,
      no2: vary(baselineReading?.no2),
      so2: vary(baselineReading?.so2),
      co: vary(baselineReading?.co),
      o3: vary(baselineReading?.o3),
      aqi: newAQI,
      source: "SIMULATED",
    },
  });

  return newReading;
};

export const simulateDroneMovement = (id) => simulateMobileMovement(id, "DRONE");
