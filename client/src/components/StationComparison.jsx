import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import { getDominantPollutant } from "../utils/hotspotDetection.js";
import { analyzePollutantIntelligence } from "../utils/pollutantIntelligence.js";

function StationComparison({ stations }) {
    const comparisonData = (stations || [])
        .filter(
            (station) =>
                station.type === "FIXED" ||
                station.type === "MOBILE" ||
                station.type === "DRONE"
        )
        .map((station) => {
            const reading = station.readings?.[0];
            const dominant = getDominantPollutant(reading) || "PM2.5";
            const shortName = station.name
                .replace(/^Demo\s+/i, "")
                .replace(/\s*-\s*Delhi$/i, "")
                .replace(/\s+Station$/i, "");

            return {
                name: station.name,
                displayName: `${shortName} (${station.type})`,
                type: station.type,
                dominant,
                aqi: reading?.aqi ?? null,
                pm25: reading?.pm25 ?? null,
                pm10: reading?.pm10 ?? null,
            };
        })
        .filter(
            (station) =>
                station.aqi !== null ||
                station.pm25 !== null ||
                station.pm10 !== null
        );

    const intelligence = analyzePollutantIntelligence(stations);

    if (comparisonData.length === 0) {
        return (
            <div className="chart-empty">
                No station readings available for multi-sensor comparison.
            </div>
        );
    }

    const tooltipStyle = {
        backgroundColor: "#111a28",
        border: "1px solid #283a52",
        borderRadius: "8px",
        color: "#f1f5f9",
        fontSize: "12px",
    };

    return (
        <div className="station-comparison-container">
            {/* Pollutant Intelligence Insights Banner */}
            <div className="pollutant-intelligence-bar">
                <div className="intel-pill">
                    <span className="intel-label">Primary Driver</span>
                    <strong className="intel-highlight">
                        {intelligence.primaryDriver} ({intelligence.driverPercentage}% of stations)
                    </strong>
                </div>

                <div className="intel-pill">
                    <span className="intel-label">Fine/Coarse Ratio</span>
                    <span className="intel-text">{intelligence.pmRatioDiagnosis}</span>
                </div>
            </div>

            <div className="comparison-charts">
                <div className="comparison-chart">
                    <div className="chart-header-row">
                        <h3>AQI Comparison (Fixed, Mobile &amp; Drone)</h3>
                        <span className="chart-sub">Index (0-500)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2d40" />
                            <XAxis
                                dataKey="displayName"
                                tick={{ fill: "#94a3b8", fontSize: 11 }}
                            />
                            <YAxis domain={[0, 500]} stroke="#64748b" tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="aqi" name="AQI" fill="#5eead4" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="comparison-chart">
                    <div className="chart-header-row">
                        <h3>PM2.5 Comparison</h3>
                        <span className="chart-sub">Fine particles (µg/m³)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2d40" />
                            <XAxis
                                dataKey="displayName"
                                tick={{ fill: "#94a3b8", fontSize: 11 }}
                            />
                            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="pm25" name="PM2.5 (µg/m³)" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="comparison-chart">
                    <div className="chart-header-row">
                        <h3>PM10 Comparison</h3>
                        <span className="chart-sub">Coarse particles (µg/m³)</span>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2d40" />
                            <XAxis
                                dataKey="displayName"
                                tick={{ fill: "#94a3b8", fontSize: 11 }}
                            />
                            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="pm10" name="PM10 (µg/m³)" fill="#c084fc" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

export default StationComparison;
