import { generateRecommendations } from "../utils/deploymentRecommendations";

export default function DeploymentRecommendations({ stations, onSelectStation }) {
    const recommendations = generateRecommendations(stations);

    return (
        <section className="section-block" id="recommendations">
            <div className="section-heading">
                <div>
                    <span className="eyebrow">TACTICAL ACTION PLAN</span>
                    <h2>Smart Deployment Recommendations</h2>
                </div>
                <span className="section-note">
                    Operator guidance for mobile &amp; drone sweeps
                </span>
            </div>

            <div className="recommendations-banner">
                <span className="recommendations-info-icon">💡</span>
                <p>
                    Recommendations dynamically synthesize detected pollution hotspots and static coverage blind spots.
                    Target coordinates guide field sweeps to verify micro-climates; stations are never moved automatically.
                </p>
            </div>

            {recommendations.length === 0 ? (
                <div className="chart-empty">
                    No active deployment recommendations. All monitoring sectors are well covered.
                </div>
            ) : (
                <div className="recommendations-grid">
                    {recommendations.map((rec) => (
                        <article className={`rec-card priority-border-${rec.priority.toLowerCase()}`} key={rec.id}>
                            <div className="rec-top">
                                <div className="rec-badges">
                                    <span className={`rec-unit-badge ${rec.unitType.toLowerCase()}-badge`}>
                                        {rec.unitType === "DRONE" ? "🚁 Drone Dispatch" : "🚐 Mobile Unit"}
                                    </span>
                                    <span className={`rec-priority-badge rec-priority-${rec.priority.toLowerCase()}`}>
                                        {rec.priority}
                                    </span>
                                </div>
                                <span className="rec-coords">
                                    ⌖ {rec.targetLat.toFixed(4)}°N, {rec.targetLon.toFixed(4)}°E
                                </span>
                            </div>

                            <h3 className="rec-title">{rec.title}</h3>
                            <div className="rec-target-zone">
                                Target Area: <strong>{rec.targetName}</strong>
                            </div>

                            <div className="rec-content-block">
                                <span className="rec-label">Why Recommended:</span>
                                <p className="rec-text">{rec.rationale}</p>
                            </div>

                            <div className="rec-content-block">
                                <span className="rec-label">Expected Intelligence Gain:</span>
                                <p className="rec-text impact-text">{rec.expectedImpact}</p>
                            </div>

                            {rec.stationId && onSelectStation && (
                                <button
                                    className="rec-action-button"
                                    onClick={() => onSelectStation(String(rec.stationId))}
                                >
                                    Inspect Station History &amp; Readings →
                                </button>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
