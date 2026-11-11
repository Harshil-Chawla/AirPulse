
function MapLegend() {
    return (
        <div className="map-legend">
            <h3>Map Legend</h3>

            <div className="legend-item">
                <span className="legend-marker fixed-marker"></span>
                <span>Fixed Station</span>
            </div>

            <div className="legend-item">
                <span className="legend-marker mobile-marker"></span>
                <span>Mobile Station</span>
            </div>

            <div className="legend-item">
                <span className="legend-marker drone-marker"></span>
                <span>Drone Station</span>
            </div>
        </div>
    );
}

export default MapLegend;
