import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

function CustomTooltip({ active, payload }) {
    if (active && payload && payload.length) {
        const item = payload[0].payload;
        return (
            <div className="aqi-chart-tooltip">
                <span className="tooltip-time">{item.fullTime || item.time}</span>
                <div className="tooltip-value-row">
                    <span className="tooltip-indicator"></span>
                    <span className="tooltip-label">AQI:</span>
                    <strong className="tooltip-val">{payload[0].value}</strong>
                </div>
            </div>
        );
    }
    return null;
}

function AQIChart({ readings }) {
    // Convert database readings into chart data
    const chartData = [...readings]
        .reverse()
        .filter((reading) => reading.aqi !== null)
        .map((reading) => ({
            time: new Date(reading.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fullTime: new Date(reading.recordedAt).toLocaleString(),
            aqi: reading.aqi,
        }));

    if (chartData.length === 0) {
        return (
            <div className="chart-empty">
                <span className="chart-empty-icon">📈</span>
                <p>No historical AQI readings available for this station.</p>
            </div>
        );
    }

    return (
        <div className="aqi-chart">
            <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="aqiGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" vertical={false} />
                    <XAxis
                        dataKey="time"
                        stroke="#64748b"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={{ stroke: "rgba(255, 255, 255, 0.08)" }}
                    />
                    <YAxis
                        stroke="#64748b"
                        domain={[0, "auto"]}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={{ stroke: "rgba(255, 255, 255, 0.08)" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="aqi"
                        stroke="#14b8a6"
                        strokeWidth={2.5}
                        fill="url(#aqiGradient)"
                        activeDot={{ r: 6, fill: "#06b6d4", stroke: "#080c14", strokeWidth: 2 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export default AQIChart;
