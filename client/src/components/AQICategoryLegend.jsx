const categories = [
    { name: "Good", range: "0–50", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.25)" },
    { name: "Satisfactory", range: "51–100", color: "#84cc16", bg: "rgba(132, 204, 22, 0.12)", border: "rgba(132, 204, 22, 0.25)" },
    { name: "Moderate", range: "101–200", color: "#eab308", bg: "rgba(234, 179, 8, 0.12)", border: "rgba(234, 179, 8, 0.25)" },
    { name: "Poor", range: "201–300", color: "#f97316", bg: "rgba(249, 115, 22, 0.12)", border: "rgba(249, 115, 22, 0.25)" },
    { name: "Very Poor", range: "301–400", color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.25)" },
    { name: "Severe", range: "401–500", color: "#a855f7", bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.25)" },
];

function AQICategoryLegend() {
    return (
        <div className="aqi-legend-grid">
            {categories.map((category) => (
                <div
                    className="aqi-legend-card"
                    key={category.name}
                    style={{ borderColor: category.border }}
                >
                    <div className="aqi-legend-header">
                        <span
                            className="aqi-legend-dot"
                            style={{ backgroundColor: category.color, boxShadow: `0 0 10px ${category.color}66` }}
                        />
                        <strong className="aqi-legend-title" style={{ color: category.color }}>{category.name}</strong>
                    </div>
                    <span className="aqi-legend-range">{category.range}</span>
                </div>
            ))}
        </div>
    );
}

export default AQICategoryLegend;
