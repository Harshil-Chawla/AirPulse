# Database choice and architecture

AirPulse stores structured monitoring data: a station's identity, type, city and base coordinates, and repeated observations containing pollutant concentrations, AQI, location, source and timestamps. PostgreSQL fits this model because readings reference a stable station and the application needs temporal queries, joins and grouped statistics.

Foreign keys enforce station references, transactions support consistent writes, and indexes support recent history retrieval. SQL also supports independent analysis outside the ORM. MongoDB could store these records, but an unbounded history embedded in a station document would be a poor fit; relational station/readings tables are straightforward here. This is a project-specific choice, not a claim that PostgreSQL is universally superior.

Architecture: React/Vite browser → HTTPS Express API on Vercel → Prisma Client with PrismaPg adapter → Neon PostgreSQL. Local development uses a local PostgreSQL instance and the Vite API proxy. The production client uses VITE_API_URL; DATABASE_URL is a backend secret. DATABASE_URL_UNPOOLED is preferred by Prisma CLI for hosted migrations when supplied.

Prisma migrations create the database structure. The seed script creates three sample stations and their initial observations. It checks station names before creating samples, but name is not a database unique key, so concurrent seed runs are not guaranteed duplicate-free.

The mobile/drone simulator appends a measurement row. Measurements are simulated; the project does not currently ingest real sensor telemetry. Backend fusion/forecasting/source-attribution libraries are prototypes and are not exposed by application routes.
