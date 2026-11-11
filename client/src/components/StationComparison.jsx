import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

function StationComparison({ stations }) {
    const comparisonData = stations
    .filter(
        (station) =>
            station.type === "FIXED" ||
            station.type === "MOBILE"
    )
    .map((station) => {
        const reading = station.readings?.[0];

        return {
            name: station.name,
            type: station.type,
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
    
    if (comparisonData.length === 0) {
        return <p>No station data available for comparison.</p>;
    }

    return (
        <div className="comparison-charts">

        <div className="comparison-chart">
            <h3>AQI Comparison</h3>
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="type"
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                    />
                    <YAxis domain={[0, 500]} />
                    <Tooltip />
                    <Bar dataKey="aqi" name="AQI" fill="#5eead4" />
                </BarChart>
            </ResponsiveContainer>
        </div>

        <div className="comparison-chart">
            <h3>PM2.5 Comparison</h3>
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="type"
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="pm25" name="PM2.5 (µg/m³)" fill="#60a5fa" />
                </BarChart>
            </ResponsiveContainer>
        </div>

        <div className="comparison-chart">
            <h3>PM10 Comparison</h3>
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="type"
                        tick={{ fill: "#9ca3af", fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="pm10" name="PM10 (µg/m³)" fill="#c084fc" />
                </BarChart>
            </ResponsiveContainer>
        </div>

    </div>
    );
}

export default StationComparison;