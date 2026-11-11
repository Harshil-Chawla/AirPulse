
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

function AQIChart({ readings }) {
    // Convert database readings into chart data
    const chartData = [...readings]
        .reverse()
        .filter((reading) => reading.aqi !== null)
        .map((reading) => ({
            time: new Date(reading.recordedAt).toLocaleString(),
            aqi: reading.aqi,
        }));

    if (chartData.length === 0) {
        return (
            <div className="chart-empty">
                No historical AQI readings available.
            </div>
        );
    }

    return (
        <div className="aqi-chart">
            <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData}>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#293b50"
                    />

                    <XAxis
                        dataKey="time"
                        stroke="#94a3b8"
                        tick={{ fontSize: 11 }}
                    />

                    <YAxis
                        stroke="#94a3b8"
                        domain={[0, "auto"]}
                    />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#17283b",
                            border: "1px solid #34465b",
                            borderRadius: "8px",
                            color: "#ffffff",
                        }}
                        labelStyle={{ color: "#94a3b8" }}
                    />

                    <Line
                        type="monotone"
                        dataKey="aqi"
                        name="AQI"
                        stroke="#5eead4"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#5eead4" }}
                        activeDot={{ r: 7 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export default AQIChart;
