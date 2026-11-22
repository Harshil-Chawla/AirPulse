# Video recording plan (approximately 8–10 minutes)

No duration was specified in the supplied guidelines. Adjust to the instructor's actual limit. Keep credentials, connection strings and environment files off screen. Open this DE folder, the ER SVG, SQL tool, source editor and working app before recording.

## 0:00–1:00 — Database choice

Show the dashboard briefly, then 01-database-choice.md.

Say: “Our group developed AirPulse to explore monitoring through fixed, mobile and drone stations. For Data Engineering, our focus is storing stations and repeated observations. We chose PostgreSQL because our structured data has a clear one-to-many relationship and needs joins, constraints, time-based retrieval and aggregation. React talks to Express, and Express uses Prisma to access PostgreSQL. This demonstration uses simulated observations.”

## 1:00–2:00 — Model

Show diagrams/er-diagram.svg and schema/schema.prisma.

Say: “Station stores identity, type, city and base coordinates. Reading stores measurements, source, measurement location and timestamps. Both have ID primary keys. Reading.stationId is a foreign key. A station may have no readings or many; each reading belongs to exactly one station. Station location and reading location are distinct because mobile assets move.”

## 2:00–3:00 — Normalization

Show 03-normalization.md.

Say: “Repeating station descriptors in every reading creates update and deletion anomalies. In 1NF each measurement occupies a row with atomic fields. With our single-column ID keys there are no partial-key dependencies, so 2NF is straightforward. The flattened design still has ReadingId determining StationId, which determines station descriptors. Splitting Station from Reading removes that transitive dependency and gives 3NF under our stated assumptions.”

## 3:00–3:45 — Implemented schema and samples

Show migration.sql and actual table contents.

Say: “The migration creates the tables, enum types, foreign key and indexes. Missing concentrations can stay null instead of becoming zero. The fixture records are simulated examples; they are not field measurements.”

## 3:45–6:45 — SQL operations

Run the query runner and open its actual output, or show queries interactively in the same isolated transaction. Explain Q01–Q12 using 04-query-guide.md. Include WHERE/ORDER BY, INNER/LEFT JOIN, aggregates, GROUP BY/HAVING, the correlated subquery, INSERT, UPDATE and DELETE. Show that deletion cascades to the test reading, then that the transaction rolls back. Do not run the writes against production public tables.

Say: “These operations answer project questions such as which assets are mobile, what each station reported most recently, which stations have repeated elevated observations, and how monitoring records are maintained. Expected results were planned in advance; these are the outputs from the actual run.” Only use that last sentence after running it successfully.

## 6:45–8:15 — Application integration

Follow 05-integration.md. Show a real count before, one mobile movement click, the new row/count after, then browser refresh. Show routes → controller → service → Prisma setup.

Say: “The click sends a POST request. The backend validates the station type and creates a Reading through Prisma, which inserts it into PostgreSQL. The dashboard retrieves updated history and coordinates. The database row and persistence after refresh prove this is not only an in-memory animation.” Only say this if showing normal mode and the actual persisted row.

## 8:15–9:15 — Integrity, performance and limits

Show index definitions and validation helpers.

Say: “The FK prevents dangling station references. Enums restrict station/source categories. The station/time index supports historical retrieval, and responses are bounded. Application checks do not replace database CHECK constraints. The current app supports inserts and retrieval; UPDATE and DELETE were demonstrated through SQL and are not exposed as application endpoints. Real sensor ingestion and field validation remain future work.”

## End — Contributions

Each member should identify their actual contribution and be prepared to explain the model, normalization and SQL independently. Show the GitHub DE folder and submitted video link. Do not claim unfinished evidence or CRUD features are complete.
