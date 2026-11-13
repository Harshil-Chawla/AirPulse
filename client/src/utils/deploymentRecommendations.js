import { detectHotspots } from "./hotspotDetection.js";
import { analyzeCoverage } from "./coverageAnalysis.js";

export function generateRecommendations(stations) {
    if (!Array.isArray(stations) || stations.length === 0) {
        return [];
    }

    const hotspots = detectHotspots(stations);
    const coverage = analyzeCoverage(stations);
    const recommendations = [];

    // 1. Top Hotspot: Drone aerial validation
    const topHotspot = hotspots[0];
    if (topHotspot && topHotspot.aqi > 100) {
        recommendations.push({
            id: `rec-hotspot-${topHotspot.id}`,
            targetName: topHotspot.name,
            targetLat: topHotspot.latitude,
            targetLon: topHotspot.longitude,
            unitType: "DRONE",
            priority: topHotspot.aqi > 300 ? "CRITICAL" : "HIGH",
            title: `Vertical Plume Profiling near ${topHotspot.name}`,
            rationale: `Station "${topHotspot.name}" reports ${topHotspot.severity} air quality (${topHotspot.aqi} AQI, dominant ${topHotspot.dominantPollutant}). Drone aerial transects are recommended to measure vertical dispersion above the surface boundary layer.`,
            expectedImpact: "Ascertain whether high pollution is trapped at pedestrian breathing level or dissipating aloft.",
            stationId: topHotspot.id,
        });
    }

    // 2. High-priority coverage gaps: Fixed-only high pollution sectors
    const highGap = coverage.coverageGaps.find(g => g.priority === "HIGH");
    if (highGap) {
        recommendations.push({
            id: `rec-gap-${highGap.sectorKey}`,
            targetName: `Sector [${highGap.sectorKey}]`,
            targetLat: highGap.centerLat,
            targetLon: highGap.centerLon,
            unitType: "MOBILE",
            priority: "HIGH",
            title: `Surface Sweep for Sector [${highGap.sectorKey}]`,
            rationale: `Sector has fixed monitoring but lacks dynamic mobile cross-validation. Peak recorded AQI is ${highGap.maxAQI ?? "elevated"}.`,
            expectedImpact: "Map localized street-canyon hotspots and vehicular pollution gradients across the grid cell.",
            stationId: null,
        });
    }

    // 3. Medium-priority coverage gaps: Single-sensor static coverage
    const mediumGap = coverage.coverageGaps.find(g => g.priority === "MEDIUM");
    if (mediumGap) {
        recommendations.push({
            id: `rec-gap-${mediumGap.sectorKey}`,
            targetName: `Sector [${mediumGap.sectorKey}]`,
            targetLat: mediumGap.centerLat,
            targetLon: mediumGap.centerLon,
            unitType: "MOBILE",
            priority: "MEDIUM",
            title: `Spatial Representativeness Survey at Sector [${mediumGap.sectorKey}]`,
            rationale: `Static station provides single-point observation. Mobile sweep will establish spatial representativeness radius.`,
            expectedImpact: "Validate whether static sensor readings accurately reflect the broader ~1.5 km² neighborhood.",
            stationId: null,
        });
    }

    // 4. Inter-station transport corridor if 2+ hotspots exist
    if (hotspots.length >= 2 && topHotspot && hotspots[1].aqi > 80) {
        const spotB = hotspots[1];
        recommendations.push({
            id: `rec-corridor-${topHotspot.id}-${spotB.id}`,
            targetName: `Corridor between ${topHotspot.name} and ${spotB.name}`,
            targetLat: Number(((topHotspot.latitude + spotB.latitude) / 2).toFixed(4)),
            targetLon: Number(((topHotspot.longitude + spotB.longitude) / 2).toFixed(4)),
            unitType: "DRONE",
            priority: "MEDIUM",
            title: "Inter-Station Transport Corridor Assessment",
            rationale: `Pollution gradient observed between monitoring nodes (${topHotspot.aqi} AQI vs ${spotB.aqi} AQI). Drone transects can detect wind-borne pollution transport corridors.`,
            expectedImpact: "Pinpoint downwind pollution drift and identify intermediate unmonitored emission sources.",
            stationId: spotB.id,
        });
    }

    return recommendations;
}
