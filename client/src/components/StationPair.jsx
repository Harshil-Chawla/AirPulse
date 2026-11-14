import { useState } from "react";

export default function StationPair({ stations }) {
    const [firstId, setFirstId] = useState("");
    const [secondId, setSecondId] = useState("");
    const first = stations.find(s => String(s.id) === firstId);
    const second = stations.find(s => String(s.id) === secondId);
    const fields = [["aqi", "AQI"], ["pm25", "PM2.5 (µg/m³)"], ["pm10", "PM10 (µg/m³)"], ["co", "CO (mg/m³)"]];
    return <section className="section-block">
        <h2>Compare two stations</h2>
        <p>Compare latest readings, including drone stations. Different times and locations can affect the comparison.</p>
        <div className="dashboard-controls">
            <label>First station<select value={firstId} onChange={e => setFirstId(e.target.value)}>
                <option value="">Choose a station</option>{stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label>Second station<select value={secondId} onChange={e => setSecondId(e.target.value)}>
                <option value="">Choose a station</option>{stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <button onClick={() => { setFirstId(secondId); setSecondId(firstId); }}>Swap stations</button>
            <button onClick={() => { setFirstId(""); setSecondId(""); }}>Clear comparison</button>
        </div>
        {first && second && first.id !== second.id ? <div className="comparison-table-wrap"><table className="comparison-table">
            <caption>Latest station readings; difference is first minus second</caption>
            <thead><tr><th>Measurement</th><th>{first.name}</th><th>{second.name}</th><th>Difference</th></tr></thead>
            <tbody>{fields.map(([key, label]) => {
                const a = first.readings?.[0]?.[key]; const b = second.readings?.[0]?.[key];
                return <tr key={key}><th scope="row">{label}</th><td>{a ?? "N/A"}</td><td>{b ?? "N/A"}</td><td>{Number.isFinite(a) && Number.isFinite(b) ? Number((a - b).toFixed(2)) : "N/A"}</td></tr>;
            })}
            <tr><th scope="row">Recorded at</th>{[first, second].map(s => <td key={s.id}>{s.readings?.[0]?.recordedAt ? new Date(s.readings[0].recordedAt).toLocaleString() : "N/A"}</td>)}<td>—</td></tr>
            <tr><th scope="row">Source</th>{[first, second].map(s => <td key={s.id}>{s.readings?.[0]?.source ?? "N/A"}</td>)}<td>—</td></tr>
            </tbody></table></div> : <p role="status">Choose two different stations to compare.</p>}
    </section>;
}
