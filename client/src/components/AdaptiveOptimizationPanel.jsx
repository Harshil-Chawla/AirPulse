import { useState } from "react";
import { computeAdaptiveDeployments } from "../utils/adaptiveMonitoringOptimization.js";

export default function AdaptiveOptimizationPanel({
    stations,
    onSelectStation,
    onMoveMobile,
    onMoveDrone,
    moving,
    droneMoving,
}) {
    const deployments = computeAdaptiveDeployments(stations);
    const [expandedStationId, setExpandedStationId] = useState(null);

    const toggleExpand = (id) => {
        setExpandedStationId(expandedStationId === id ? null : id);
    };

    return (
        <section className="section-block" id="optimization">
            <div className="section-heading">
                <div>
                    <span className="eyebrow">OPTIMIZATION ENGINE</span>
                    <h2>Adaptive Mobile Monitoring Deployment</h2>
                </div>
                <span className="section-note">
                    Multi-criteria priority ranking for mobile &amp; drone fleet
                </span>
            </div>

            <div className="opt-banner">
                <span className="opt-banner-icon">⚙</span>
                <p>
                    Data-driven algorithm evaluates candidate waypoints using a multi-criteria scoring function:
                    <strong> Pollution Severity (35%)</strong>, <strong>Coverage Gap (30%)</strong>, <strong>Reading Freshness (20%)</strong>, and <strong>Distance Cost (15%)</strong>.
                    Strict safety policy: <em>Units never move automatically without operator confirmation.</em>
                </p>
            </div>

            {deployments.length === 0 ? (
                <div className="chart-empty">
                    No active mobile or drone assets available for adaptive optimization.
                </div>
            ) : (
                <div className="opt-grid">
                    {deployments.map((dep) => {
                        const top = dep.optimalWaypoint;
                        const isMoving = dep.stationType === "MOBILE" ? moving : droneMoving;

                        return (
                            <article className="opt-card" key={dep.stationId}>
                                <div className="opt-card-top">
                                    <div className="opt-station-meta">
                                        <span className={`opt-type-tag tag-${dep.stationType.toLowerCase()}`}>
                                            {dep.stationType === "DRONE" ? "🚁 UAV Drone" : "🚐 Mobile Van"}
                                        </span>
                                        <h3 className="opt-station-name">{dep.stationName}</h3>
                                    </div>
                                    <div className="opt-score-badge">
                                        <span className="score-val">{top.priorityScore}</span>
                                        <span className="score-sub">Priority Score</span>
                                    </div>
                                </div>

                                <div className="opt-target-box">
                                    <div className="target-label-row">
                                        <span className="target-eyebrow">Optimal Target Destination</span>
                                        <span className="target-distance">{top.distanceKm.toFixed(2)} km away</span>
                                    </div>
                                    <div className="target-name">{top.candidateName}</div>
                                    <div className="target-coords">
                                        Coordinates: {top.candidateLat.toFixed(4)}°N, {top.candidateLon.toFixed(4)}°E
                                    </div>
                                </div>

                                <div className="opt-breakdown-section">
                                    <span className="breakdown-title">Multi-Criteria Score Breakdown</span>
                                    <div className="breakdown-bars">
                                        <div className="bar-row">
                                            <span>Severity (35%)</span>
                                            <div className="bar-track">
                                                <div className="bar-fill bar-severity" style={{ width: `${top.scoreBreakdown.severity}%` }}></div>
                                            </div>
                                            <strong>{top.scoreBreakdown.severity}</strong>
                                        </div>
                                        <div className="bar-row">
                                            <span>Coverage Gap (30%)</span>
                                            <div className="bar-track">
                                                <div className="bar-fill bar-gap" style={{ width: `${top.scoreBreakdown.coverageGap}%` }}></div>
                                            </div>
                                            <strong>{top.scoreBreakdown.coverageGap}</strong>
                                        </div>
                                        <div className="bar-row">
                                            <span>Freshness (20%)</span>
                                            <div className="bar-track">
                                                <div className="bar-fill bar-freshness" style={{ width: `${top.scoreBreakdown.freshness}%` }}></div>
                                            </div>
                                            <strong>{top.scoreBreakdown.freshness}</strong>
                                        </div>
                                        <div className="bar-row">
                                            <span>Range Efficiency (15%)</span>
                                            <div className="bar-track">
                                                <div className="bar-fill bar-efficiency" style={{ width: `${top.scoreBreakdown.distanceEfficiency}%` }}></div>
                                            </div>
                                            <strong>{top.scoreBreakdown.distanceEfficiency}</strong>
                                        </div>
                                    </div>
                                </div>

                                <div className="opt-rationale-box">
                                    <span className="rationale-label">Optimization Rationale:</span>
                                    <p className="rationale-text">{top.rationale}</p>
                                </div>

                                <div className="opt-action-footer">
                                    {dep.stationType === "MOBILE" && onMoveMobile && (
                                        <button
                                            className="movement-button mobile-movement-button opt-deploy-btn"
                                            disabled={isMoving}
                                            onClick={() => {
                                                if (onSelectStation) onSelectStation(String(dep.stationId));
                                                onMoveMobile();
                                            }}
                                        >
                                            {isMoving ? "Simulating Mobile Sweep..." : "Confirm & Execute Mobile Sweep"}
                                        </button>
                                    )}

                                    {dep.stationType === "DRONE" && onMoveDrone && (
                                        <button
                                            className="movement-button drone-movement-button opt-deploy-btn"
                                            disabled={isMoving}
                                            onClick={() => {
                                                if (onSelectStation) onSelectStation(String(dep.stationId));
                                                onMoveDrone();
                                            }}
                                        >
                                            {isMoving ? "Simulating Drone Flight..." : "Confirm & Execute Drone Flight"}
                                        </button>
                                    )}

                                    <button
                                        className="opt-toggle-btn"
                                        onClick={() => toggleExpand(dep.stationId)}
                                    >
                                        {expandedStationId === dep.stationId ? "Hide Alternatives ▲" : `View Alternatives (${dep.allWaypoints.length - 1}) ▼`}
                                    </button>
                                </div>

                                {expandedStationId === dep.stationId && (
                                    <div className="opt-alternatives-list">
                                        <span className="alt-title">Alternative Candidate Waypoints:</span>
                                        {dep.allWaypoints.slice(1).map((alt, idx) => (
                                            <div className="alt-row" key={idx}>
                                                <div className="alt-info">
                                                    <span className="alt-name">{alt.candidateName}</span>
                                                    <span className="alt-dist">{alt.distanceKm.toFixed(2)} km · Est. AQI {alt.estimatedAQI}</span>
                                                </div>
                                                <div className="alt-score">
                                                    Score: <strong>{alt.priorityScore}</strong>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
