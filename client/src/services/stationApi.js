
const API_URL = "http://localhost:3000/api";

export const fetchStations = async () => {
    const response = await fetch(`${API_URL}/stations`);

    if (!response.ok) {
        throw new Error("Failed to fetch stations");
    }

    const data = await response.json();

    return data.stations;
};

export const simulateStationMovement = async (stationId) => {
  const response = await fetch(
    `${API_URL}/stations/${stationId}/simulate-movement`,
    {
      method: "POST",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to simulate movement");
  }

  return data.reading;
};


export const fetchStationReadings = async (stationId) => {
    const response = await fetch(
        `${API_URL}/stations/${stationId}/readings`
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Failed to fetch station readings"
        );
    }

    return data.readings;
};
