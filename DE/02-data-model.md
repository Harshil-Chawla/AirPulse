# Data model

Station has id (integer PK), name and city (text), type (StationType enum), latitude/longitude (double precision base coordinates), createdAt and updatedAt (timestamps).

Reading has id (integer PK), stationId (integer FK), nullable pm25, pm10, no2, so2, co and o3 (double precision), nullable aqi (integer), non-null latitude/longitude (observation coordinates), source (DataSource enum), recordedAt and createdAt (timestamps).

StationType = FIXED, MOBILE, DRONE. DataSource = CPCB, OPENAQ, OPEN_METEO, SIMULATED. Enum options do not establish that external providers are integrated.

One Station has zero or many Readings. Every Reading belongs to exactly one Station. stationId is NOT unique: multiple readings per station are expected. There is no required one-to-one or many-to-many relationship in this scope.

The FK references Station.id with ON DELETE CASCADE and ON UPDATE CASCADE in the SQL migration. Deleting a station deletes its historical readings, so deletion is demonstrated only on an isolated fixture.

Station coordinates describe the station's base; Reading coordinates describe an observation location. Neither stationId nor recordedAt alone identifies a reading. The current schema does not enforce uniqueness on their combination, station names or observation source/timestamp pairs.

PM2.5, PM10, NO2, SO2 and O3 are displayed in µg/m³; CO is displayed in mg/m³. AQI is a unitless index. Units are a project convention, not separate database metadata or CHECK constraints.

See diagrams/er-diagram.svg for a directly viewable diagram and er-diagram.mmd for editable Mermaid source. schema/schema.prisma and schema/migration.sql are the authoritative implemented definitions.
