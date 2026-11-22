-- Q01 — Delhi mobile stations
SELECT id,name,type,city FROM "Station" WHERE city='Delhi' AND type='MOBILE' ORDER BY id;

-- Q02 — Latest observation history
SELECT id,"stationId",aqi,"recordedAt" FROM "Reading" ORDER BY "recordedAt" DESC,id DESC LIMIT 3;

-- Q03 — Station and observation join
SELECT s.name,s.type,r.aqi FROM "Station" s JOIN "Reading" r ON r."stationId"=s.id ORDER BY r.id;

-- Q04 — Per-station summary including stations without observations
SELECT s.id,s.name,COUNT(r.id) AS reading_count,ROUND(AVG(r.aqi),1) AS average_aqi,MAX(r.aqi) AS highest_aqi FROM "Station" s LEFT JOIN "Reading" r ON r."stationId"=s.id GROUP BY s.id,s.name ORDER BY s.id;

-- Q05 — Repeated elevated observations
SELECT "stationId",COUNT(*) AS elevated_count FROM "Reading" WHERE aqi>100 GROUP BY "stationId" HAVING COUNT(*)>=2 ORDER BY "stationId";

-- Q06 — Latest reading from every reporting station
SELECT DISTINCT ON (s.id) s.id,s.name,r.aqi,r."recordedAt" FROM "Station" s JOIN "Reading" r ON r."stationId"=s.id ORDER BY s.id,r."recordedAt" DESC,r.id DESC;

-- Q07 — Above-station-average readings
SELECT r.id,r."stationId",r.aqi FROM "Reading" r WHERE r.aqi>(SELECT AVG(h.aqi) FROM "Reading" h WHERE h."stationId"=r."stationId") ORDER BY r.id;

-- Q08 — Measurement time range
SELECT id,"stationId",aqi FROM "Reading" WHERE "recordedAt">='2026-11-14 10:00:30' AND "recordedAt"<='2026-11-14 10:01:00' ORDER BY id;

-- Q09 — Register a station
INSERT INTO "Station" (id,name,type,city,latitude,longitude,"updatedAt") VALUES (900,'DE recording station','MOBILE','Delhi',28.61,77.21,CURRENT_TIMESTAMP) RETURNING id,name;

-- Q10 — Correct station metadata
UPDATE "Station" SET name='DE recording station corrected',"updatedAt"=CURRENT_TIMESTAMP WHERE id=900 RETURNING id,name;

-- Q11 — Record a measurement
INSERT INTO "Reading" (id,"stationId",aqi,latitude,longitude,source) VALUES (900,900,150,28.611,77.211,'SIMULATED') RETURNING id,"stationId",aqi;

-- Q12 — Retire the demonstration station and verify cascade
DELETE FROM "Station" WHERE id=900 RETURNING id,name;
SELECT COUNT(*) AS remaining_station_readings FROM "Reading" WHERE "stationId"=900;
