BEGIN;
CREATE SCHEMA airpulse_de_recording;
SET LOCAL search_path TO airpulse_de_recording;
-- CreateEnum
CREATE TYPE "StationType" AS ENUM ('FIXED', 'MOBILE', 'DRONE');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('CPCB', 'OPENAQ', 'OPEN_METEO', 'SIMULATED');

-- CreateTable
CREATE TABLE "Station" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StationType" NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" SERIAL NOT NULL,
    "stationId" INTEGER NOT NULL,
    "pm25" DOUBLE PRECISION,
    "pm10" DOUBLE PRECISION,
    "no2" DOUBLE PRECISION,
    "so2" DOUBLE PRECISION,
    "co" DOUBLE PRECISION,
    "o3" DOUBLE PRECISION,
    "aqi" INTEGER,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "source" "DataSource" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reading_stationId_recordedAt_idx" ON "Reading"("stationId", "recordedAt");

-- CreateIndex
CREATE INDEX "Reading_recordedAt_idx" ON "Reading"("recordedAt");

-- AddForeignKey
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Station" (id,name,type,city,latitude,longitude,"updatedAt") VALUES
(1,'DE Fixed Delhi','FIXED','Delhi',28.6139,77.209,'2026-11-14 10:00:00'),
(2,'DE Mobile Delhi','MOBILE','Delhi',28.62,77.215,'2026-11-14 10:00:00'),
(3,'DE Drone Delhi','DRONE','Delhi',28.63,77.22,'2026-11-14 10:00:00');
INSERT INTO "Reading" (id,"stationId",pm25,pm10,no2,so2,co,o3,aqi,latitude,longitude,source,"recordedAt") VALUES
(1,1,85,145,32,12,0.8,28,165,28.6139,77.209,'SIMULATED','2026-11-14 10:00:00'),
(2,2,110,180,40,15,1.1,35,190,28.62,77.215,'SIMULATED','2026-11-14 10:00:00'),
(3,3,65,120,25,10,0.6,22,135,28.63,77.22,'SIMULATED','2026-11-14 10:00:00'),
(4,2,115,185,42,15,1.2,36,200,28.6205,77.2155,'SIMULATED','2026-11-14 10:01:00');
