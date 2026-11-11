
import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Popup,
    Polyline,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

function StationMap({ stations, movementTrails }) {
    const firstStation = stations[0];

    const center = firstStation
        ? [firstStation.latitude, firstStation.longitude]
        : [28.6139, 77.2090];

    const stationColors = {
        FIXED: "#5eead4",
        MOBILE: "#60a5fa",
        DRONE: "#c084fc",
    };

    return (
        <div className="map-container">
            <MapContainer
                center={center}
                zoom={12}
                scrollWheelZoom={true}
                className="station-map"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Mobile and drone movement trails */}
                {stations
                    .filter(
                        (station) =>
                            station.type === "MOBILE" || station.type === "DRONE"
                    )
                    .map((station) => {
                        const trail = movementTrails?.[station.id] || [];

                        if (trail.length < 2) return null;

                        return (
                            <Polyline
                                key={`trail-${station.id}`}
                                positions={trail.map((reading) => [
                                    reading.latitude,
                                    reading.longitude,
                                ])}
                                pathOptions={{
                                    color: stationColors[station.type],
                                    weight: 3,
                                    opacity: 0.7,
                                }}
                            />
                        );
                    }
                )}

                {stations.map((station) => {
                    const reading = station.readings?.[0];

                    // Use the latest reading location for mobile stations.
                    const latitude =
                        reading?.latitude ?? station.latitude;

                    const longitude =
                        reading?.longitude ?? station.longitude;

                    return (
                        <CircleMarker
                            key={station.id}
                            center={[latitude, longitude]}
                            radius={10}
                            pathOptions={{
                                color: stationColors[station.type] || "#ffffff",
                                fillColor: stationColors[station.type] || "#ffffff",
                                fillOpacity: 0.85,
                                weight: 2,
                            }}
                        >
                            <Popup>
                                <strong>{station.name}</strong>
                                <br />
                                Type: {station.type}
                                <br />
                                AQI: {reading?.aqi ?? "Unavailable"}
                                <br />
                                PM2.5: {reading?.pm25 ?? "Unavailable"}
                                <br />
                                Source: {reading?.source ?? "Unavailable"}
                            </Popup>
                        </CircleMarker>
                    );
                })}
            </MapContainer>

            <div className="map-legend">
                <span><i className="legend-fixed"></i> Fixed</span>
                <span><i className="legend-mobile"></i> Mobile</span>
                <span><i className="legend-drone"></i> Drone</span>
            </div>
        </div>
    );
}

export default StationMap;
