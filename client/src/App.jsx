
import { Suspense, lazy, useEffect, useRef, useState } from "react";

import "./App.css";

import { downloadSnapshot } from "./utils/exportSnapshot";
import { downloadReadings } from "./utils/exportReadings";
import { historyInWindow } from "./utils/historyWindow";
import { filterStations } from "./utils/stationFilters";
import AreaSummary from "./components/AreaSummary";
const StationMap = lazy(() => import("./components/StationMap"));

import AQIChart from "./components/AQIChart";
import AQICategoryLegend from "./components/AQICategoryLegend";
import StationPair from "./components/StationPair";
import StationComparison from "./components/StationComparison";
import HotspotPanel from "./components/HotspotPanel";
import AnomalyAlerts from "./components/AnomalyAlerts";
import CoverageIntelligence from "./components/CoverageIntelligence";
import DeploymentRecommendations from "./components/DeploymentRecommendations";
import AdaptiveOptimizationPanel from "./components/AdaptiveOptimizationPanel";
import { getDominantPollutant } from "./utils/hotspotDetection";


import {
    demoMode,
    fetchStations,
    simulateStationMovement,
    fetchStationReadings,
    simulateDroneMovement,
} from "./services/stationApi";


function getAQIStatus(aqi) {
    if (aqi === null || aqi === undefined || !Number.isFinite(Number(aqi)) || Number(aqi) < 0) {
        return { label: "Unavailable", className: "unavailable" };
    }

    const val = Number(aqi);
    if (val <= 50) return { label: "Good", className: "good" };
    if (val <= 100) return { label: "Satisfactory", className: "satisfactory" };
    if (val <= 200) return { label: "Moderate", className: "moderate" };
    if (val <= 300) return { label: "Poor", className: "poor" };
    if (val <= 400) return { label: "Very Poor", className: "very-poor" };

    return { label: "Severe", className: "severe" };
}


function App() {
    const selectionRef = useRef("");
    const refreshAbortRef = useRef(null);
    const selectStation = (id) => {
        selectionRef.current = id;
        setSelectedStationId(id);
        setHistoricalReadings([]);
    };
    const [stations, setStations] = useState([]);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("name");
    const [stationFilter, setStationFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [refreshError, setRefreshError] = useState("");
    const [error, setError] = useState("");
    const [movementError, setMovementError] = useState("");
    const [moving, setMoving] = useState(false);
    const [droneMoving, setDroneMoving] = useState(false);
    const [selectedStationId, setSelectedStationId] = useState("");
    const [historyHours, setHistoryHours] = useState("all");
    const [historicalReadings, setHistoricalReadings] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState("");
    const [movementTrails, setMovementTrails] = useState({});
    const [lastUpdated, setLastUpdated] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Load stations initially
    useEffect(() => {
        const loadStations = async () => {
            try {
                const data = await fetchStations();
                setStations(data);
                setLastUpdated(new Date());
                setRefreshError("");

                if (data.length > 0) {
                    selectionRef.current = String(data[0].id);
                    setSelectedStationId(String(data[0].id));
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadStations();
    }, []);

    // Load historical readings
    useEffect(() => {
        if (!selectedStationId) return;

        let ignore = false;

        const loadHistory = async () => {
            try {
                setHistoryLoading(true);
                setHistoryError("");

                const data = await fetchStationReadings(selectedStationId);

                if (!ignore) {
                    setHistoricalReadings(data);
                }
            } catch (err) {
                if (!ignore) {
                    setHistoryError(err.message);
                }
            } finally {
                if (!ignore) {
                    setHistoryLoading(false);
                }
            }
        };

        loadHistory();

        return () => {
            ignore = true;
        };
    }, [selectedStationId]);

    // Fetch movement history for mobile and drone stations
    useEffect(() => {
        let ignore = false;
        const loadMovementTrails = async () => {
            try {
                const movingStations = stations.filter(
                    (station) =>
                        station.type === "MOBILE" ||
                        station.type === "DRONE"
                );

                const results = await Promise.all(
                    movingStations.map(async (station) => {
                        const readings = await fetchStationReadings(station.id);

                        return {
                            stationId: station.id,
                            trail: readings
                                .filter(
                                    (reading) =>
                                        reading.latitude != null &&
                                        reading.longitude != null
                                )
                                .reverse()
                                .map((reading) => ({
                                    latitude: reading.latitude,
                                    longitude: reading.longitude,
                                })),
                        };
                    })
                );

                const trails = {};

                results.forEach(({ stationId, trail }) => {
                    trails[stationId] = trail;
                });

                if (!ignore) setMovementTrails(trails);
            } catch (err) {
                console.error("Failed to load movement trails:", err);
            }
        };

        if (stations.length > 0) {
            loadMovementTrails();
        }
        return () => { ignore = true; };
    }, [stations]);

    // Automatically refresh dashboard every 30 seconds

    useEffect(() => {
        if (!autoRefresh) return;
        let cancelled = false;
        let busy = false;
        const refreshDashboard = async () => {
            if (busy) return;
            busy = true;
            // Cancel any in-flight readings fetch from a previous refresh
            if (refreshAbortRef.current) refreshAbortRef.current.abort();
            const controller = new AbortController();
            refreshAbortRef.current = controller;
            try {
                const updatedStations = await fetchStations();
                if (cancelled) return;
                setStations(updatedStations);

                if (selectedStationId) {
                    const updatedHistory = await fetchStationReadings(
                        selectedStationId,
                        controller.signal
                    );
                    if (!cancelled && selectionRef.current === selectedStationId) { setHistoricalReadings(updatedHistory); setHistoryError(""); }
                }

                if (cancelled) return;
                // Update timestamp after successful refresh
                setLastUpdated(new Date());
                setRefreshError("");

            } catch (err) {
                if (err.name === "AbortError") return;
                if (cancelled) return;
                setRefreshError("Refresh failed. Showing previously loaded data.");
                console.error("Dashboard refresh failed:", err);
            } finally { busy = false; }
        };

        const intervalId = setInterval(refreshDashboard, 30000);

        return () => { cancelled = true; clearInterval(intervalId); refreshAbortRef.current?.abort(); };
    }, [selectedStationId, autoRefresh]);


    // Simulate mobile station movement
    const handleMoveMobileStation = async () => {
        const mobileStation = stations.find(station => String(station.id) === selectedStationId && station.type === "MOBILE");

        if (!mobileStation) {
            setMovementError("No mobile station found");
            return;
        }

        try {
            setMoving(true);
            setMovementError("");

            await simulateStationMovement(mobileStation.id);

            const updatedStations = await fetchStations();
            setStations(updatedStations);

            if (selectedStationId) {
                const updatedHistory = await fetchStationReadings(
                    selectedStationId
                );
                if (selectionRef.current === selectedStationId) { setHistoricalReadings(updatedHistory); setHistoryError(""); }
            }
        } catch (err) {
            console.error(err);
            setMovementError(err.message);
        } finally {
            setMoving(false);
        }
    };

    const handleRefresh = async () => {
      if (refreshing) return;
      // Cancel any in-flight readings fetch from auto-refresh
      if (refreshAbortRef.current) refreshAbortRef.current.abort();
      const controller = new AbortController();
      refreshAbortRef.current = controller;
      try {
          setRefreshing(true);

          const updatedStations = await fetchStations();
          setStations(updatedStations);

          if (selectedStationId) {
              const updatedHistory = await fetchStationReadings(
                  selectedStationId,
                  controller.signal
              );
              if (selectionRef.current === selectedStationId) { setHistoricalReadings(updatedHistory); setHistoryError(""); }
          }

          setLastUpdated(new Date());
                setRefreshError("");
          setError("");
      } catch (err) {
          if (err.name === "AbortError") return;
          setRefreshError(err.message);
      } finally {
          setRefreshing(false);
      }
    };

    // Simulate drone station movement
    const handleMoveDroneStation = async () => {
        const droneStation = stations.find(station => String(station.id) === selectedStationId && station.type === "DRONE");

        if (!droneStation) {
            setMovementError("No drone station found");
            return;
        }

        try {
            setDroneMoving(true);
            setMovementError("");

            await simulateDroneMovement(droneStation.id);

            const updatedStations = await fetchStations();
            setStations(updatedStations);

            if (selectedStationId) {
                const updatedHistory = await fetchStationReadings(
                    selectedStationId
                );
                if (selectionRef.current === selectedStationId) { setHistoricalReadings(updatedHistory); setHistoryError(""); }
            }
        } catch (err) {
            console.error(err);
            setMovementError(err.message);
        } finally {
            setDroneMoving(false);
        }
    };

    // Latest readings from all stations
    const readings = stations
        .map((station) => station.readings?.[0])
        .filter(Boolean);

    const reportedAQIs = readings
        .map((reading) => reading.aqi)
        .filter((aqi) => Number.isFinite(aqi) && aqi >= 0 && aqi <= 500);

    const highestAQI = reportedAQIs.length
        ? Math.max(...reportedAQIs)
        : null;

    // Status for the main AQI card
    const aqiStatus = getAQIStatus(highestAQI);

    // Station counts
    const fixedCount = stations.filter(
        (station) => station.type === "FIXED"
    ).length;

    const mobileCount = stations.filter(
        (station) => station.type === "MOBILE"
    ).length;

    const droneCount = stations.filter(
        (station) => station.type === "DRONE"
    ).length;

    // Highest pollutant reading
    
    const getPeakPollutant = (key) => {
      const peakStation = stations
        .filter((station) => {
            const val = station.readings?.[0]?.[key];
            return Number.isFinite(val) && val >= 0;
        })
        .reduce((highest, station) => {
            if (
                !highest ||
                station.readings[0][key] >
                    highest.readings[0][key]
            ) {
                return station;
            }

            return highest;
        }, null);

        
        if (!peakStation) return null;

        return {
            value: peakStation.readings[0][key],
            stationName: peakStation.name,
            source: peakStation.readings[0].source,
        };

    };

    const pollutants = [
        {
            name: "PM2.5",
            key: "pm25",
            unit: "µg/m³",
            description: "Fine particles",
        },
        {
            name: "PM10",
            key: "pm10",
            unit: "µg/m³",
            description: "Coarse particles",
        },
        {
            name: "NO₂",
            key: "no2",
            unit: "µg/m³",
            description: "Nitrogen dioxide",
        },
        {
            name: "SO₂",
            key: "so2",
            unit: "µg/m³",
            description: "Sulphur dioxide",
        },
        {
            name: "CO",
            key: "co",
            unit: "mg/m³",
            description: "Carbon monoxide",
        },
        {
            name: "O₃",
            key: "o3",
            unit: "µg/m³",
            description: "Ozone",
        },
    ];

    // Filter monitoring stations
    const filteredStations = filterStations(stations, { type: stationFilter, search, sort });

    // Find selected station
    const selectedStation = stations.find(
        (station) => String(station.id) === String(selectedStationId)
    );

    const displayedHistory = historyInWindow(historicalReadings, historyHours);
    const selectedReading = selectedStation?.readings?.[0];

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loader"></div>
                <p>Loading AirPulse monitoring data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-screen">
                <h2>Unable to load AirPulse</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="app-layout">

            {/* Sidebar */}
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand-icon">✦</div>
                    <div>
                        <h2>AirPulse</h2>
                        <span>ENVIRONMENTAL INTELLIGENCE</span>
                    </div>
                </div>

                <div className="sidebar-label">WORKSPACE</div>

                <nav className="navigation">
                    <a href="#overview" className="nav-link active">
                        <span>▦</span> Overview
                    </a>

                    <a href="#hotspots" className="nav-link">
                        <span>🔥</span> Hotspots
                    </a>

                    <a href="#anomalies" className="nav-link">
                        <span>⚡</span> Anomaly Detection
                    </a>

                    <a href="#coverage" className="nav-link">
                        <span>🌐</span> Coverage Gaps
                    </a>

                    <a href="#recommendations" className="nav-link">
                        <span>🎯</span> Smart Dispatch
                    </a>

                    <a href="#optimization" className="nav-link">
                        <span>🧭</span> Adaptive Optimization
                    </a>

                    <a href="#stations" className="nav-link">
                        <span>⌖</span> Monitoring Stations
                    </a>

                    <a href="#pollutants" className="nav-link">
                        <span>◉</span> Pollutants
                    </a>
                </nav>

                <div className="sidebar-bottom">
                    <div className="system-status">
                        <span className="status-dot"></span>
                        <div>
                            <strong>{refreshError ? "Refresh interrupted" : "Data loaded"}</strong>
                            <p>{demoMode ? "Local demo data" : "Station data loaded"}</p>
                        </div>
                    </div>

                    <p className="sidebar-footer">AIRPULSE v1.0.0</p>
                </div>
            </aside>

            {/* Main Dashboard */}
            <main className="main-content">

                {/* Header */}
                <header className="topbar">
                    <div>
                        <p className="breadcrumb">WORKSPACE / OVERVIEW</p>
                        <h1>Air Quality Dashboard</h1>
                        <p className="page-subtitle">
                            Smart Mobile Air Quality Monitoring System
                        </p>
                    </div>

                  <div className="topbar-right">
                      <span className="live-indicator">
                          <span className="status-dot"></span>
                          {demoMode ? "DEMO PREVIEW" : "STATION MONITORING"}
                      </span>

                      <button
                          className="refresh-button"
                          onClick={handleRefresh}
                          disabled={refreshing}
                      >
                          {refreshing ? "Refreshing..." : "↻ Refresh"}
                      </button>

                      <button className="refresh-button" aria-pressed={!autoRefresh} onClick={() => setAutoRefresh(value => !value)}>
                          {autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
                      </button>
                      <span role="status">{autoRefresh ? "Updates every 30 seconds" : "Auto-refresh paused"}</span>
                      <div className="last-updated">
                          <span>Last updated</span>
                          <strong>
                              {lastUpdated
                                  ? lastUpdated.toLocaleTimeString()
                                  : "Waiting for data..."}
                          </strong>
                      </div>

                      <div className="location-tag">
                          <span>⌖</span> Delhi, India
                      </div>
                  </div>
                </header>

                {refreshError && (
                    <div className="dashboard-alert warning-alert" role="status">
                        <span>⚠</span> {refreshError}
                    </div>
                )}
                {demoMode && (
                    <div className="demo-banner-compact" role="status">
                        <span className="demo-badge">Demo Mode</span>
                        <span className="demo-text">Demo preview: sample data stored only in this browser session. Reloading resets it.</span>
                    </div>
                )}
                {/* AQI Overview */}
                <section className="hero-grid" id="overview">

                    <div className="aqi-panel">
                        <div className="panel-heading">
                            <div>
                                <span className="eyebrow">
                                    AIR QUALITY OVERVIEW
                                </span>
                                <h2>Highest Station AQI</h2>
                            </div>
                            <span className="aqi-icon">◉</span>
                        </div>

                        <div className="aqi-main">
                            <div className="aqi-number">
                                {highestAQI ?? "N/A"}
                            </div>

                            <div className={`aqi-status ${aqiStatus.className}`}>
                                {aqiStatus.label}
                            </div>
                        </div>

                        <p className="aqi-description">
                            {highestAQI !== null
                                ? "Highest reported AQI among the monitored stations."
                                : "No AQI readings are currently available."}
                        </p>

                        <div className="aqi-scale">
                            <div className="scale-segment good-bg"></div>
                            <div className="scale-segment satisfactory-bg"></div>
                            <div className="scale-segment moderate-bg"></div>
                            <div className="scale-segment poor-bg"></div>
                            <div className="scale-segment very-poor-bg"></div>
                            <div className="scale-segment severe-bg"></div>
                        </div>

                        <div className="scale-labels">
                            <span>Good</span>
                            <span>Moderate</span>
                            <span>Severe</span>
                        </div>
                    </div>

                    <div className="station-summary-panel">
                        <div className="panel-heading">
                            <div>
                                <span className="eyebrow">NETWORK STATUS</span>
                                <h2>Station Network</h2>
                            </div>
                            <span className="network-icon">⌖</span>
                        </div>

                        <div className="total-stations">
                            <strong>{stations.length}</strong>
                            <span>Total Monitoring Stations</span>
                        </div>

                        <div className="station-breakdown">
                            <div className="breakdown-item">
                                <span className="legend-dot fixed-dot"></span>
                                <span>Fixed Stations</span>
                                <strong>{fixedCount}</strong>
                            </div>

                            <div className="breakdown-item">
                                <span className="legend-dot mobile-dot"></span>
                                <span>Mobile Stations</span>
                                <strong>{mobileCount}</strong>
                            </div>

                            <div className="breakdown-item">
                                <span className="legend-dot drone-dot"></span>
                                <span>Drone Stations</span>
                                <strong>{droneCount}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                {/* AQI Categories */}
                <div className="section-block">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">INDIA AQI STANDARD</span>
                            <h2>Air Quality Categories</h2>
                        </div>
                    </div>

                    <AQICategoryLegend />
                </div>

                {/* Pollution Hotspot Detection */}
                <HotspotPanel stations={stations} />

                {/* Spatiotemporal AQI Anomaly Detection */}
                <AnomalyAlerts stations={stations} onSelectStation={selectStation} />

                {/* Pollutant Cards */}
                <section className="section-block" id="pollutants">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">AIR COMPOSITION</span>
                            <h2>Pollutant Overview</h2>
                        </div>

                        <span className="section-note">
                            Peak reading across stations
                        </span>
                    </div>

                    <div className="pollutant-grid">
                        {pollutants.map((pollutant) => {
                            const peak = getPeakPollutant(pollutant.key);
                            const isLoading = loading;
                            return (
                                <article
                                    className="pollutant-card"
                                    key={pollutant.key}
                                >
                                    <div className="pollutant-card-top">
                                        <span className="pollutant-name">
                                            {pollutant.name}
                                        </span>

                                        <span className="pollutant-symbol">◈</span>
                                    </div>

                                    <div className="pollutant-value">
                                        {isLoading ? "..." : peak?.value ?? "N/A"}
                                    </div>

                                    <span className="pollutant-unit">
                                        {pollutant.unit}
                                    </span>

                                    <p className="pollutant-station">
                                        {isLoading
                                            ? "Loading station..."
                                            : peak?.stationName ?? "No station data"}
                                    </p>

                                    <span className="pollutant-source">
                                        Source: {peak?.source ?? "Unknown"}
                                    </span>

                                    <p>{pollutant.description}</p>
                                </article>
                            );
                        })}
                    </div>
                </section>


                {/* AQI History */}
                <section className="section-block" id="history">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">
                                HISTORICAL ANALYTICS
                            </span>
                            <h2>AQI History</h2>
                        </div>
                        <span className="section-note">
                            Recorded station readings
                        </span>
                    </div>

                    <div className="history-toolbar">
                        <div className="history-selector">
                            <label htmlFor="station-history">
                                Select station
                            </label>

                            <select
                                id="station-history"
                                value={selectedStationId}
                                onChange={(e) =>
                                    selectStation(e.target.value)
                                }
                            >
                                {stations.map((station) => (
                                    <option
                                        key={station.id}
                                        value={station.id}
                                    >
                                        {station.name} ({station.type})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button className="movement-button history-export-btn" disabled={historyLoading || !!historyError || !displayedHistory.length}
                            onClick={() => downloadReadings(displayedHistory, selectedStationId)}>
                            <span>↓</span> Export displayed history (up to 200 readings)
                        </button>
                    </div>

                    <div className="dashboard-controls">
                        <label>History window<select value={historyHours} onChange={e => setHistoryHours(e.target.value)}>
                            <option value="all">All loaded readings</option><option value="1">Last hour</option>
                            <option value="6">Last 6 hours</option><option value="24">Last 24 hours</option>
                        </select></label>
                        <span>{displayedHistory.length} of {historicalReadings.length} loaded readings. Maximum 200; older history may not be loaded.</span>
                    </div>
                    {historyLoading ? (
                        <p>Loading historical readings...</p>
                    ) : historyError ? (
                        <p className="history-error">{historyError}</p>
                    ) : (
                        <AQIChart readings={displayedHistory} />
                    )}
                </section>

                <StationPair stations={stations} />
                <AreaSummary stations={stations} />

                {/* Coverage Intelligence & Gaps */}
                <CoverageIntelligence stations={stations} />

                {/* Smart Mobile & Drone Deployment Recommendations */}
                <DeploymentRecommendations stations={stations} onSelectStation={selectStation} />

                {/* Adaptive Mobile Monitoring Optimization Engine */}
                <AdaptiveOptimizationPanel
                    stations={stations}
                    onSelectStation={selectStation}
                    onMoveMobile={handleMoveMobileStation}
                    onMoveDrone={handleMoveDroneStation}
                    moving={moving}
                    droneMoving={droneMoving}
                />
                {/* Fixed vs Mobile Comparison */}
                <section className="section-block" id="comparison">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">
                                STATION ANALYTICS
                            </span>
                            <h2>Fixed vs Mobile Comparison</h2>
                        </div>
                        <span className="section-note">
                            Latest AQI readings
                        </span>
                    </div>

                    <StationComparison stations={stations} />
                </section>

                {/* Station Map */}
                <section className="section-block" id="map">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">
                                GEOGRAPHIC INTELLIGENCE
                            </span>
                            <h2>Live Station Map</h2>
                        </div>

                        <span className="section-note">
                            {stations.length} mapped locations
                        </span>
                    </div>

                    <button
                      className="movement-button mobile-movement-button"
                      onClick={handleMoveMobileStation}
                      disabled={moving || selectedStation?.type !== "MOBILE"}
                  >
                      {moving
                          ? "Moving station..."
                          : "Move selected mobile station"}
                  </button>

                  <button
                      className="movement-button drone-movement-button"
                      onClick={handleMoveDroneStation}
                      disabled={droneMoving || selectedStation?.type !== "DRONE"}
                  >
                      {droneMoving
                          ? "Moving drone..."
                          : "Move selected drone station"}
                  </button>

                    {movementError && (
                        <p className="movement-error">{movementError}</p>
                    )}



                    <Suspense fallback={<p>Loading map...</p>}>
                    <StationMap
                        stations={stations}
                        selectedStationId={selectedStationId}
                        movementTrails={movementTrails}
                    />
                    </Suspense>
                </section>

                {/* Station Details */}
                <section className="station-details-section">
                    <div className="section-heading">
                        <div>
                            <h2>Station Details</h2>
                            <p>
                                Detailed pollutant readings for the selected station
                            </p>
                        </div>
                    </div>

                    {selectedStation && selectedReading ? (
                        <>
                            <div className="station-details-header">
                                <h3>{selectedStation.name}</h3>
                                <span className="station-type">
                                    {selectedStation.type}
                                </span>
                            </div>

                            <div className="pollutant-details-grid">
                                {pollutants.map((pollutant) => (
                                    <div
                                        className="pollutant-detail-card"
                                        key={pollutant.key}
                                    >
                                        <span>{pollutant.name}</span>
                                        <strong>
                                            {selectedReading[pollutant.key] ?? "N/A"}
                                        </strong>
                                        <small>{pollutant.unit}</small>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p>No station readings available.</p>
                    )}
                </section>

                {/* Monitoring Stations */}

                <section className="monitoring-section" id="stations">
                    <div className="section-heading">
                        <div>
                            <h2>Monitoring Stations</h2>
                            <p>
                                {filteredStations.length} stations registered
                            </p>
                        </div>
                    </div>

                    <div className="dashboard-controls">
                        <label>Search stations<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Station or city" /></label>
                        <label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}>
                            <option value="name">Station name</option><option value="aqi">Highest AQI first</option>
                        </select></label>
                        <button type="button" onClick={() => { setSearch(""); setSort("name"); setStationFilter("ALL"); }}>Reset filters</button>
                        <button disabled={!filteredStations.length} onClick={() => downloadSnapshot(filteredStations)}>Download filtered stations CSV</button>
                        <span role="status">{filteredStations.length} matching stations</span>
                    </div>
                    <div className="station-filters">
                        <button
                            className={
                                stationFilter === "ALL" ? "active" : ""
                            }
                            onClick={() => setStationFilter("ALL")}
                        >
                            All
                        </button>

                        <button
                            className={
                                stationFilter === "FIXED" ? "active" : ""
                            }
                            onClick={() => setStationFilter("FIXED")}
                        >
                            Fixed
                        </button>

                        <button
                            className={
                                stationFilter === "MOBILE" ? "active" : ""
                            }
                            onClick={() => setStationFilter("MOBILE")}
                        >
                            Mobile
                        </button>

                        <button
                            className={
                                stationFilter === "DRONE" ? "active" : ""
                            }
                            onClick={() => setStationFilter("DRONE")}
                        >
                            Drone
                        </button>
                    </div>

                    <div className="station-list">
                        {filteredStations.length === 0 ? (
                            <p>No stations found for this filter.</p>
                        ) : (
                            filteredStations.map((station) => {
                                const reading = station.readings?.[0];
                                const status = getAQIStatus(reading?.aqi);

                                return (
                                    <article
                                        className={`station-row ${
                                            String(selectedStationId) ===
                                            String(station.id)
                                                ? "selected"
                                                : ""
                                        }`}
                                        key={station.id}
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={String(selectedStationId) === String(station.id)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault(); selectStation(String(station.id));
                                            }
                                        }}
                                        onClick={() =>
                                            selectStation(
                                                String(station.id)
                                            )
                                        }
                                    >
                                        <div className="station-info">
                                            <h3>{station.name}</h3>
                                            <p>{station.city}, India</p>
                                            <div className="station-type-tags">
                                                <span className="station-type">
                                                    {station.type}
                                                </span>
                                                {reading && (
                                                    <span className="dominant-chip">
                                                        {getDominantPollutant(reading) || "PM2.5"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="station-aqi-column">
                                            <span className="column-label">
                                                AQI
                                            </span>
                                            <strong>
                                                {reading?.aqi ?? "N/A"}
                                            </strong>
                                            <span
                                                className={`mini-status ${status.className}`}
                                            >
                                                {status.label}
                                            </span>
                                        </div>

                                        <div className="station-pollutants">
                                            <span className="column-label">
                                                PM2.5
                                            </span>
                                            <strong>
                                                {reading?.pm25 ?? "N/A"}
                                            </strong>
                                            <small>µg/m³</small>
                                        </div>

                                        <div className="station-pollutants">
                                            <span className="column-label">
                                                PM10
                                            </span>
                                            <strong>
                                                {reading?.pm10 ?? "N/A"}
                                            </strong>
                                            <small>µg/m³</small>
                                        </div>

                                        <div className="station-source">
                                            <span className="column-label">
                                                DATA SOURCE
                                            </span>
                                            <span className="source-badge">
                                                {reading?.source ?? "N/A"}
                                            </span>
                                        </div>

                                        <div className="station-time-column">
                                            <span className="column-label">
                                                LAST UPDATED
                                            </span>
                                            <span>
                                                {reading?.recordedAt
                                                    ? new Date(
                                                        reading.recordedAt
                                                    ).toLocaleString()
                                                    : "N/A"}
                                            </span>
                                        </div>
                                    </article>
                                );
                            })
                        )}
                    </div>
                </section>

                {/* Footer */}
                <footer className="dashboard-footer">
                    <span>AirPulse Environmental Intelligence</span>
                    <span>
                        Data displayed from registered monitoring stations
                    </span>
                </footer>

            </main>
        </div>
    );
}

export default App;
