# AirPulse — Data Engineering submission

This pack describes the implemented PostgreSQL database and its integration with AirPulse. It was assembled from the current repository source. Measurements and SQL demonstration records are simulated.

## Contents

- 01-database-choice.md: database choice, entities and architecture
- 02-data-model.md and diagrams/: ER diagram, attributes and cardinality
- 03-normalization.md: functional dependencies and 1NF–3NF reasoning
- schema/: exact Prisma schema, SQL migration and seed source
- sample-records/: portable example CSVs and isolated SQL fixture
- queries.sql, run-queries.mjs and 04-query-guide.md: 12 project-specific operations, explanations and expected behavior
- evidence/: actual automated test logs, plus clearly marked instructions for capturing live execution and integration
- 05-integration.md: application flow, underlying SQL, supported operations and gaps
- 06-integrity-performance.md: constraints, validation, indexing and limitations
- 07-video-script.md: narration and screen-recording order
- SUBMISSION-CHECKLIST.md: requirements and unfinished evidence

## Execute the SQL demonstration

From server, install normal backend dependencies with npm ci. Set DATABASE_URL using your existing private environment file, then run:

    node --env-file=.env.production.local DE/run-queries.mjs

After moving DE to the repository root, run the same command from server using `../DE/run-queries.mjs` instead of `DE/run-queries.mjs`.

Alternatively use a local .env file configured for your test database. Do not include either environment file in this pack or the recording.

The runner creates an isolated schema inside a transaction, loads the exact supplied fixture, runs all 12 operations, writes actual outputs to evidence/query-execution.txt, and rolls back the transaction. It does not modify public.Station or public.Reading. The database role must be allowed to create schemas. PostgreSQL sequence increments in the isolated schema are irrelevant because that schema is rolled back too.

If the role cannot create a schema, use a dedicated local test database. Do not remove the isolation to run write demonstrations against live data.

## Evidence status

Automated test results are included as logs. SQL output descriptions in the guide are EXPECTED fixture results, not claimed execution evidence. Live database/query output and browser screenshots must be captured with the runner and application before submission. SQL CRUD is demonstrated by the exercise; the current application exposes only reading insertion and retrieval, not station update/delete endpoints.

The required final destination is a root-level DE/ folder in the team's GitHub repository. This pack is staged in server/DE because of the writable workspace boundary; move it to the root before committing. The supplied ZIP already contains DE as its top-level folder.
