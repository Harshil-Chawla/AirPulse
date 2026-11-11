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
        .map((station) => ({
            name: station.name,
            type: station.type,
            aqi: station.readings?.[0]?.aqi ?? 0,
        }));

    if (comparisonData.length === 0) {
        return <p>No station data available for comparison.</p>;
    }

    return (
        <div className="comparison-chart">
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 500]} />
                    <Tooltip />
                    <Bar
                        dataKey="aqi"
                        name="AQI"
                        fill="#5eead4"
                        radius={[6, 6, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export default StationComparison;