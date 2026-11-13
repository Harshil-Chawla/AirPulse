import { analyzeCoverage } from "../utils/coverageAnalysis";

export default function CoverageIntelligence({ stations }) {
    const analysis = analyzeCoverage(stations);

    return (
        <section className="section-block" id="coverage">
            <div className="section-heading">
                <div>
                    <span className="eyebrow">MONITORING AUDIT</span>
                    <h2>Coverage Intelligence &amp; Gaps</h2>
                </div>
                <span className="section-note">
                    Analysis of fixed vs mobile sensor spatial distribution
                </span>
            </div>

            <div className="coverage-metrics-row">
                <div className="coverage-metric-card">
                    <span className="metric-title">Hyperlocal Mobile Ratio</span>
                    <div className="metric-val-group">
                        <span className="metric-val">{analysis.coverageScore}%</span>
                        <span className="metric-sub">Dynamic Coverage</span>
                    </div>
                    <div className="coverage-progress-bar">
                        <div
                            className="coverage-progress-fill"
                            style={{ width: `${analysis.coverageScore}%` }}
                        ></div>
                    </div>
                </div>

                <div className="coverage-metric-card">
                    <span className="metric-title">Monitored Grid Sectors</span>
                    <div className="metric-val-group">
                        <span className="metric-val">{analysis.activeSectors.length}</span>
                        <span className="metric-sub">~1.5 km² Active Cells</span>
                    </div>
                </div>

                <div className="coverage-metric-card">
                    <span className="metric-title">Identified Coverage Gaps</span>
                    <div className="metric-val-group">
                        <span className={`metric-val ${analysis.gapCount > 0 ? "highlight-gap" : ""}`}>
                            {analysis.gapCount}
                        </span>
                        <span className="metric-sub">Sectors Needing Mobility</span>
                    </div>
                </div>
            </div>

            {analysis.coverageGaps.length === 0 ? (
                <div className="chart-empty">
                    Full dynamic monitoring coverage across all active sectors.
                </div>
            ) : (
                <div className="coverage-gaps-list">
                    {analysis.coverageGaps.map((gap) => (
                        <article className={`gap-card gap-${gap.priority.toLowerCase()}`} key={gap.sectorKey}>
                            <div className="gap-top">
                                <div className="gap-location">
                                    <span className="gap-key">Sector [{gap.sectorKey}]</span>
                                    <span className="gap-coords">
                                        Center: {gap.centerLat.toFixed(3)}°N, {gap.centerLon.toFixed(3)}°E
                                    </span>
                                </div>
                                <span className={`gap-priority-pill priority-${gap.priority.toLowerCase()}`}>
                                    {gap.priority} PRIORITY GAP
                                </span>
                            </div>

                            <p className="gap-reason">
                                <strong>Diagnosis:</strong> {gap.gapReason}
                            </p>

                            <div className="gap-footer">
                                <div className="gap-breakdown">
                                    <span>Sensors:</span>
                                    <span className="tag-fixed">{gap.fixedCount} Fixed</span>
                                    <span className="tag-mobile">{gap.mobileCount} Mobile</span>
                                    <span className="tag-drone">{gap.droneCount} Drone</span>
                                </div>
                                {gap.maxAQI !== null && (
                                    <div className="gap-aqi-indicator">
                                        Peak Sector AQI: <strong>{gap.maxAQI}</strong>
                                    </div>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
