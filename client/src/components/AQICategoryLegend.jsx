const categories = [
    { name: "Good", range: "0–50", color: "#22c55e" },
    { name: "Satisfactory", range: "51–100", color: "#84cc16" },
    { name: "Moderate", range: "101–200", color: "#eab308" },
    { name: "Poor", range: "201–300", color: "#f97316" },
    { name: "Very Poor", range: "301–400", color: "#ef4444" },
    { name: "Severe", range: "401–500", color: "#a855f7" },
];

function AQICategoryLegend() {
    return (
        <div className="aqi-legend">
            {categories.map((category) => (
                <div className="aqi-legend-item" key={category.name}>
                    <span
                        className="aqi-legend-dot"
                        style={{ backgroundColor: category.color }}
                    />
                    <div>
                        <strong>{category.name}</strong>
                        <span>{category.range}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default AQICategoryLegend;