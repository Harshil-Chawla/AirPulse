import { detectHotspots } from "../utils/hotspotDetection";

export default function HotspotPanel({ stations }) {
    const hotspots = detectHotspots(stations);

    return (
        <section className="section-block" id="hotspots">
            <div className="section-heading">
                <div>
                    <span className="eyebrow">PRIORITY ACTION ZONES</span>
                    <h2>Pollution Hotspot Detection</h2>
                </div>
                <span className="section-note">
                    Ranked by severity &amp; dominant pollutant
                </span>
            </div>

            {hotspots.length === 0 ? (
                <div className="chart-empty">No active pollution hotspots detected.</div>
            ) : (
                <div className="hotspot-grid">
                    {hotspots.map((spot, index) => (
                        <article className={`hotspot-card ${spot.severityClass}-border`} key={spot.id}>
                            <div className="hotspot-header">
                                <div className="hotspot-rank">
                                    <span className="rank-num">#{index + 1}</span>
                                    <span className="hotspot-name">{spot.name}</span>
                                </div>
                                <span className={`hotspot-type-tag ${spot.type.toLowerCase()}-tag`}>
                                    {spot.type}
                                </span>
                            </div>

                            <div className="hotspot-body">
                                <div className="hotspot-aqi-block">
                                    <span className="hotspot-aqi-val">{spot.aqi}</span>
                                    <span className="hotspot-aqi-label">AQI</span>
                                </div>

                                <div className="hotspot-details">
                                    <div className="hotspot-severity">
                                        <span className={`severity-pill ${spot.severityClass}`}>
                                            {spot.severity}
                                        </span>
                                    </div>
                                    <div className="hotspot-pollutant">
                                        Dominant: <strong>{spot.dominantPollutant}</strong>
                                    </div>
                                    <div className="hotspot-coords">
                                        ⌖ {spot.latitude.toFixed(4)}°N, {spot.longitude.toFixed(4)}°E
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
