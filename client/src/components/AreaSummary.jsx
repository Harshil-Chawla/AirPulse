import { getAreaSummary } from "../utils/areaSummary";

export default function AreaSummary({ stations }) {
    const areas = getAreaSummary(stations);
    return <section className="section-block">
        <h2>Area coverage</h2>
        <p>Readings from the last hour grouped into approximate 1 km cells around Delhi. Each station has equal weight.</p>
        <p>This demo average is not an official area AQI. Readings may have different ages; one location cannot represent a whole area.</p>
        {areas.length === 0 ? <p>No located AQI readings available.</p> :
            <div className="station-list">{areas.map(area => <article className="pollutant-card" key={area.key}>
                <h3>Grid {area.key}</h3>
                <p>{area.names}</p>
                <p>Average AQI: {area.average} · Stations: {area.count}</p>
                <p>{area.count === 1 ? "Limited coverage: only one station" : `Difference between highest and lowest AQI: ${area.spread}`}</p>
            </article>)}</div>}
    </section>;
}
