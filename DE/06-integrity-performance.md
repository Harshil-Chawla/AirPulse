# Integrity and performance

Implemented database safeguards: primary keys, NOT NULL for required identity/location/source/time fields, foreign key Station→Reading, enum types and cascade deletion. Nullable pollutant values distinguish unknown measurements from zero.

Application code validates station IDs, history limits and dates. normalizeReading rejects missing/blank/boolean coordinates and invalid numeric measurements, but this helper is not an exposed ingestion route. It must not be described as database-enforced validation. There are no database CHECK constraints for valid coordinate ranges, nonnegative pollution or 0–500 AQI. Direct SQL can bypass application validation.

Station names are not unique. Observation deduplication is not implemented; repeated timestamps can be stored. Sequence IDs establish identity but do not prove two rows represent different physical sensor samples. Future ingestion should use a provider/device observation key and an appropriate uniqueness policy.

The composite Reading(stationId, recordedAt) index supports station equality plus temporal filtering/sorting. Reading(recordedAt) supports cross-station time searches. Primary key indexes support identifier lookups. LIMIT bounds returned rows but does not itself bound retained history. Do not claim an index always makes a query faster; use EXPLAIN (ANALYZE, BUFFERS) on SELECT queries with representative data. A sequential scan can be preferable for this tiny seed dataset.

Larger deployments can use keyset pagination ordered by recordedAt and id, database-side aggregation, retention/partitioning policies, bounded caching and suitable pooling. Current station-existence cache is bounded at 1000 entries and has a 60-second TTL; it can briefly reflect stale metadata after external changes.

The normalization helper raises PM10 to PM2.5 when an inversion occurs. This is a demo sanitization policy, not scientifically validated calibration. Real ingestion should preserve raw data and attach quality flags rather than silently correcting observations without provenance.

Public simulation endpoints allow writes when enabled and have no user authentication or per-user authorization. Disable them unless an intentional public demonstration is required.
