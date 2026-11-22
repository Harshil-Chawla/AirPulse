# Example records

These CSVs are a deliberately small, deterministic teaching fixture, not a production database export. IDs and timestamps are assigned explicitly for repeatable query explanations. They resemble the application's initial seed values, with one extra mobile observation for history/aggregation demonstrations. They must not be represented as captured physical sensor data.

The runner creates these same rows in an isolated schema. The copied schema/seed.js is the actual application seed source; run it from its original server/prisma location, not from this documentation folder, because its relative imports assume that location.
