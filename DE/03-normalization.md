# Normalization through 3NF

## Assumptions and functional dependencies

Station.id → name, type, city, stationLatitude, stationLongitude, createdAt, updatedAt.
Reading.id → stationId, pollutant concentrations, aqi, readingLatitude, readingLongitude, source, recordedAt, createdAt.

Each station ID identifies one station. Names need not be unique. A timestamp and station pair is not a declared candidate key. Station and reading coordinates represent different facts. Reported AQI is treated as an independently supplied observation, not as a value functionally determined by the instantaneous pollutant columns: the project does not store all averaging windows and calculation metadata required to assert that dependency.

## Before normalization

A conceptual combined row could contain ReadingId, StationId, StationName, StationType, City, BaseLatitude, BaseLongitude, Pollutants, ObservationLocation and RecordedAt. Repeating station descriptors for every observation causes redundant storage.

Update anomaly: changing a station name would require changing many observations. Insertion anomaly: if station details existed only in observation rows, a station with no readings could not be represented cleanly. Deletion anomaly: deleting its last observation could remove station identity.

## First normal form

Represent observations as individual rows, not lists of historical measurements in a station cell. Give each row a key. Store each pollutant concentration and coordinate as an atomic column. These requirements address repeating groups; simply adding a surrogate key alone would not establish 1NF.

## Second normal form

Under the declared single-column ID candidate keys there can be no partial dependency on part of a composite key. The flattened observation design can therefore satisfy 2NF while still containing station redundancy. Do not incorrectly claim its decomposition is needed to remove a partial dependency on the surrogate ID.

## Third normal form

In the flattened design, ReadingId → StationId → StationName/Type/City/BaseCoordinates is a transitive dependency. Decompose station descriptors into Station, retaining stationId as the reference in Reading. The resulting tables have non-key facts dependent on their respective IDs, without a further non-key determinant under the stated assumptions.

The split is lossless for valid observations because stationId references a unique Station primary key. The FK prevents dangling references. Station descriptors can now be updated once, and stations can exist without readings.

A separate City entity or Pollutant entity is not automatically necessary for this scope. City has no additional dependent attributes here; a long-format pollutant table may become useful when variable sensor types or per-measurement unit metadata are introduced.

The authoritative final normalized structure is in schema/. Normalization does not by itself guarantee measurement validity, prevent duplicate telemetry, or make measurements representative of an area.
