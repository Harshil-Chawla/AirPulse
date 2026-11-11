
import StationMap from "./components/StationMap";
import { useEffect, useState } from "react";

import "./App.css";

import AQIChart from "./components/AQIChart";

import AQICategoryLegend from "./components/AQICategoryLegend";

import {
    fetchStations,
    simulateStationMovement,
    fetchStationReadings,
} from "./services/stationApi";

import StationComparison from "./components/StationComparison";

function getAQIStatus(aqi) {
    if (aqi === null || aqi === undefined) {
        return { label: "Unavailable", className: "unavailable" };
    }

    if (aqi <= 50) return { label: "Good", className: "good" };
    if (aqi <= 100) return { label: "Satisfactory", className: "satisfactory" };
    if (aqi <= 200) return { label: "Moderate", className: "moderate" };
    if (aqi <= 300) return { label: "Poor", className: "poor" };
    if (aqi <= 400) return { label: "Very Poor", className: "very-poor" };

    return { label: "Severe", className: "severe" };
}

function App() {
    const [stations, setStations] = useState([]);
    const [stationFilter, setStationFilter] = useState("ALL");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [movementError, setMovementError] = useState("");
    const [moving, setMoving] = useState(false);
    const [selectedStationId, setSelectedStationId] = useState("");
    const [historicalReadings, setHistoricalReadings] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState("");

    // Load stations initially
    useEffect(() => {
        const loadStations = async () => {
            try {
                const data = await fetchStations();
                setStations(data);

                if (data.length > 0) {
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

    // Automatically refresh dashboard every 30 seconds
    useEffect(() => {
        const refreshDashboard = async () => {
            try {
                const updatedStations = await fetchStations();
                setStations(updatedStations);

                if (selectedStationId) {
                    const updatedHistory = await fetchStationReadings(
                        selectedStationId
                    );
                    setHistoricalReadings(updatedHistory);
                }
            } catch (err) {
                console.error("Dashboard refresh failed:", err);
            }
        };

        const intervalId = setInterval(refreshDashboard, 30000);

        return () => clearInterval(intervalId);
    }, [selectedStationId]);

    // Simulate mobile station movement
    const handleMoveMobileStation = async () => {
        const mobileStation = stations.find(
            (station) => station.type === "MOBILE"
        );

        if (!mobileStation) {
            setError("No mobile station found");
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
                setHistoricalReadings(updatedHistory);
            }
        } catch (err) {
            console.error(err);
            setMovementError(err.message);
        } finally {
            setMoving(false);
        }
    };

    // Latest readings from all stations
    const readings = stations
        .map((station) => station.readings?.[0])
        .filter(Boolean);

    const reportedAQIs = readings
        .map((reading) => reading.aqi)
        .filter((aqi) => Number.isFinite(aqi));

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
        const values = readings
            .map((reading) => reading[key])
            .filter((value) => Number.isFinite(value));

        return values.length ? Math.max(...values) : null;
    };

    const pollutants = [
        { name: "PM2.5", key: "pm25", unit: "µg/m³", description: "Fine particles" },
        { name: "PM10", key: "pm10", unit: "µg/m³", description: "Coarse particles" },
        { name: "NO₂", key: "no2", unit: "µg/m³", description: "Nitrogen dioxide" },
        { name: "SO₂", key: "so2", unit: "µg/m³", description: "Sulphur dioxide" },
        { name: "CO", key: "co", unit: "mg/m³", description: "Carbon monoxide" },
        { name: "O₃", key: "o3", unit: "µg/m³", description: "Ozone" },
    ];

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
    const filteredStations =
    stationFilter === "ALL"
        ? stations
        : stations.filter(
              (station) => station.type === stationFilter
          );

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
                            <strong>System Online</strong>
                            <p>Backend connected</p>
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
                            LIVE MONITORING
                        </span>

                        <div className="location-tag">
                            <span>⌖</span> Delhi, India
                        </div>
                    </div>
                </header>

                {/* AQI Overview */}
                <section className="hero-grid" id="overview">

                    <div className="aqi-panel">
                        <div className="panel-heading">
                            <div>
                                <span className="eyebrow">AIR QUALITY OVERVIEW</span>
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

                <div className="section-block">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">INDIA AQI STANDARD</span>
                            <h2>Air Quality Categories</h2>
                        </div>
                    </div>

                    <AQICategoryLegend />
                </div>

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
                        {pollutants.map((pollutant) => (
                            <article className="pollutant-card" key={pollutant.key}>
                                <div className="pollutant-card-top">
                                    <span className="pollutant-name">
                                        {pollutant.name}
                                    </span>
                                    <span className="pollutant-symbol">◈</span>
                                </div>

                                <div className="pollutant-value">
                                    {getPeakPollutant(pollutant.key) ?? "N/A"}
                                </div>

                                <span className="pollutant-unit">
                                    {pollutant.unit}
                                </span>

                                <p>{pollutant.description}</p>
                            </article>
                        ))}
                    </div>
                </section>

                        <section className="section-block" id="history">
    <div className="section-heading">
        <div>
            <span className="eyebrow">HISTORICAL ANALYTICS</span>
            <h2>AQI History</h2>
        </div>
        <span className="section-note">Recorded station readings</span>
    </div>

    <div className="history-controls">
        <label htmlFor="station-history">Select station</label>

        <select
            id="station-history"
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
        >
            {stations.map((station) => (
                <option key={station.id} value={station.id}>
                    {station.name}
                </option>
            ))}
        </select>
    </div>

    {historyLoading ? (
        <p>Loading historical readings...</p>
    ) : historyError ? (
        <p className="history-error">{historyError}</p>
    ) : (
        <AQIChart readings={historicalReadings} />
    )}
</section>

<section className="section-block" id="comparison">
    <div className="section-heading">
        <div>
            <span className="eyebrow">STATION ANALYTICS</span>
            <h2>Fixed vs Mobile Comparison</h2>
        </div>
        <span className="section-note">
            Latest AQI readings
        </span>
    </div>

    <StationComparison stations={stations} />
</section>
                {/* Station Map */}
               
<section className="section-block">
    <div className="section-heading">
        <div>
            <span className="eyebrow">GEOGRAPHIC INTELLIGENCE</span>
            <h2>Live Station Map</h2>
        </div>
        <span className="section-note">
            {stations.length} mapped locations
        </span>
    </div>

    <button
        className="movement-button"
        onClick={handleMoveMobileStation}
        disabled={moving || mobileCount === 0}
    >
        {moving ? "Moving station..." : "Simulate Mobile Movement"}
    </button>

    {movementError && (
        <p className="movement-error">{movementError}</p>
    )}

    <StationMap stations={stations} />
</section>

                {/* Monitoring Stations */}

<section className="monitoring-section">
    <div className="section-heading">
        <div>
            <h2>Monitoring Stations</h2>
            <p>{filteredStations.length} stations registered</p>
        </div>
    </div>

    <div className="station-filters">
        <button
            className={stationFilter === "ALL" ? "active" : ""}
            onClick={() => setStationFilter("ALL")}
        >
            All
        </button>

        <button
            className={stationFilter === "FIXED" ? "active" : ""}
            onClick={() => setStationFilter("FIXED")}
        >
            Fixed
        </button>

        <button
            className={stationFilter === "MOBILE" ? "active" : ""}
            onClick={() => setStationFilter("MOBILE")}
        >
            Mobile
        </button>

        <button
            className={stationFilter === "DRONE" ? "active" : ""}
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
                    <article className="station-row" key={station.id}>
                        <div className="station-info">
                            <h3>{station.name}</h3>
                            <p>{station.city}, India</p>
                            <span className="station-type">
                                {station.type}
                            </span>
                        </div>

                        <div className="station-aqi-column">
                            <span className="column-label">AQI</span>
                            <strong>{reading?.aqi ?? "N/A"}</strong>
                            <span className={`mini-status ${status.className}`}>
                                {status.label}
                            </span>
                        </div>

                        <div className="station-pollutants">
                            <span className="column-label">PM2.5</span>
                            <strong>{reading?.pm25 ?? "N/A"}</strong>
                            <small>µg/m³</small>
                        </div>

                        <div className="station-pollutants">
                            <span className="column-label">PM10</span>
                            <strong>{reading?.pm10 ?? "N/A"}</strong>
                            <small>µg/m³</small>
                        </div>

                        <div className="station-source">
                            <span className="column-label">DATA SOURCE</span>
                            <span className="source-badge">
                                {reading?.source ?? "N/A"}
                            </span>
                        </div>

                        <div className="station-time-column">
                            <span className="column-label">LAST UPDATED</span>
                            <span>
                                {reading?.recordedAt
                                    ? new Date(reading.recordedAt).toLocaleString()
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
                    <span>Data displayed from registered monitoring stations</span>
                </footer>

            </main>
        </div>
    );
}

export default App;
