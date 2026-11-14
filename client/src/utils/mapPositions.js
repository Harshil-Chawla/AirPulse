export function stationPosition(station) {
    if (!station) return null;
    const reading = station.readings?.[0];
    const latitude = reading?.latitude ?? station.latitude;
    const longitude = reading?.longitude ?? station.longitude;
    return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? [latitude, longitude] : null;
}
