# Backend integration and evidence

## Implemented operations

GET /api/stations → fetchStations → getAllStations → prisma.station.findMany with the latest Reading. Conceptually SELECT stations plus the most recent associated reading.

GET /api/stations/:id/readings → validated stationId/historyOptions → getStationReadings → prisma.reading.findMany WHERE stationId with optional date bounds, ordered by recordedAt descending and bounded by limit.

GET /api/stations/:id/stats → getStationAggregates → summary of bounded reading history. These statistics cover loaded rows, not necessarily every historical measurement.

POST /api/stations/:id/simulate-movement and /simulate-drone-movement → type validation → Prisma reading.create → SQL INSERT into Reading. ENABLE_SIMULATION must be true. Sample measurements and coordinates are simulated; nothing controls a physical station.

src/lib/prisma.js constructs PrismaClient with PrismaPg using DATABASE_URL. prisma.config.ts uses the direct connection when configured for CLI migrations. Source files are in server/src/{routes,controllers,services,lib}.

## Record proof of persistence

1. Choose the local app or deployed normal-mode app, not VITE_DEMO_MODE=true (that mode uses browser memory).
2. Identify the actual mobile station ID in Station; do not assume fixture ID 2 equals the live ID.
3. Run the queries below and save the results before the click.
4. Select that station in the dashboard and click Move selected mobile station once.
5. Rerun the queries; show the extra row and its measurement location. Refresh the browser to show persistence.
6. Repeat for drone if desired. Save screenshots alongside the SQL output in evidence/.

    SELECT COUNT(*) FROM "Reading" WHERE "stationId" = <actual_mobile_id>;
    SELECT id, "stationId", latitude, longitude, aqi, source, "recordedAt"
    FROM "Reading" WHERE "stationId" = <actual_mobile_id>
    ORDER BY "recordedAt" DESC, id DESC LIMIT 3;

## Known requirement gap

There are NO station metadata update or station deletion HTTP endpoints in the current application. The dashboard cannot demonstrate those application operations. Q10/Q12 show SQL UPDATE/DELETE only. Do not label this as completed application CRUD. Add appropriate backend operations and controls if the instructor requires all four operations through the app, then capture their actual behavior.

Backend analytics under src/analytics are tested prototypes, not integrated API endpoints. No ingestion endpoint for real external sensors exists.
