import { detectSpatiotemporalAnomalies } from "../utils/anomalyDetection.js";

export default function AnomalyAlerts({ stations, onSelectStation }) {
    const analysis = detectSpatiotemporalAnomalies(stations);

    return (
        <section className="section-block" id="anomalies">
            <div className="section-heading">
                <div>
                    <span className="eyebrow">SPATIOTEMPORAL ANALYTICS</span>
                    <h2>Pollution Anomaly Detection</h2>
                </div>
                <span className="section-note">
                    Statistical z-score &amp; spatial neighborhood consensus
                </span>
            </div>

            <div className="anomaly-summary-row">
                <div className="anomaly-stat-card">
                    <span className="anomaly-stat-title">Sensors Evaluated</span>
                    <span className="anomaly-stat-num">{analysis.totalChecked}</span>
                    <span className="anomaly-stat-sub">Spatiotemporal Window</span>
                </div>

                <div className="anomaly-stat-card">
                    <span className="anomaly-stat-title">Active Anomalies</span>
                    <span className={`anomaly-stat-num ${analysis.activeCount > 0 ? "text-warn" : "text-ok"}`}>
                        {analysis.activeCount}
                    </span>
                    <span className="anomaly-stat-sub">
                        {analysis.activeCount === 0 ? "Normal Variance" : "Statistical Outliers"}
                    </span>
                </div>

                <div className="anomaly-stat-card">
                    <span className="anomaly-stat-title">Status</span>
                    <span className={`anomaly-stat-badge ${analysis.hasCritical ? "badge-critical" : "badge-nominal"}`}>
                        {analysis.hasCritical ? "Critical Alert" : analysis.activeCount > 0 ? "Advisory" : "Nominal"}
                    </span>
                    <span className="anomaly-stat-sub">Real-Time Baseline</span>
                </div>
            </div>

            {analysis.anomalies.length === 0 ? (
                <div className="chart-empty anomaly-clean-banner">
                    <span>✓</span> All monitoring stations are operating within normal temporal and spatial variance bounds. No anomalous pollution spikes detected.
                </div>
            ) : (
                <div className="anomaly-cards-grid">
                    {analysis.anomalies.map((anomaly) => (
                        <article className={`anomaly-card severity-card-${anomaly.severity.toLowerCase()}`} key={anomaly.id}>
                            <div className="anomaly-card-top">
                                <div className="anomaly-type-group">
                                    <span className="anomaly-type-pill">
                                        {anomaly.anomalyType.replace(/_/g, " ")}
                                    </span>
                                    <span className={`anomaly-severity-pill severity-${anomaly.severity.toLowerCase()}`}>
                                        {anomaly.severity}
                                    </span>
                                </div>
                                <span className="anomaly-station-tag">
                                    {anomaly.stationType}
                                </span>
                            </div>

                            <div className="anomaly-card-header">
                                <h3 className="anomaly-station-title">{anomaly.stationName}</h3>
                                <span className="anomaly-coords">
                                    ⌖ {anomaly.latitude.toFixed(4)}°N, {anomaly.longitude.toFixed(4)}°E
                                </span>
                            </div>

                            <p className="anomaly-diagnosis">
                                {anomaly.diagnosis}
                            </p>

                            <div className="anomaly-metrics-grid">
                                <div className="anomaly-metric-box">
                                    <span className="box-label">Current AQI</span>
                                    <strong className="box-val">{anomaly.currentAQI}</strong>
                                </div>
                                <div className="anomaly-metric-box">
                                    <span className="box-label">Baseline Reference</span>
                                    <strong className="box-val">{anomaly.baselineAQI}</strong>
                                </div>
                                <div className="anomaly-metric-box">
                                    <span className="box-label">Deviation (Δ)</span>
                                    <strong className="box-val text-delta">
                                        {anomaly.delta > 0 ? `+${anomaly.delta}` : anomaly.delta}
                                    </strong>
                                </div>
                                {anomaly.zScore !== null && (
                                    <div className="anomaly-metric-box">
                                        <span className="box-label">Z-Score</span>
                                        <strong className="box-val">
                                            {anomaly.zScore > 0 ? `+${anomaly.zScore}σ` : `${anomaly.zScore}σ`}
                                        </strong>
                                    </div>
                                )}
                            </div>

                            {onSelectStation && (
                                <button
                                    className="anomaly-inspect-btn"
                                    onClick={() => onSelectStation(String(anomaly.stationId))}
                                >
                                    Inspect Station Telemetry →
                                </button>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
