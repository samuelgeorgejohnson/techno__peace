import { useMemo } from "react";
import { useLocation } from "@technopeace/codex-map/src/useLocation";
import SkyInstrument from "../components/SkyInstrument";

export default function InstrumentApp() {
  const { location, error: locationError, isRequestingLocation, requestCurrentLocation, source } = useLocation();

  const locationText = useMemo(() => {
    if (location.placeName) return location.placeName;

    if (location.lat !== 0 || location.lon !== 0) {
      const sourceLabel = source === "manual" ? "manual" : source === "gps" ? "gps" : "default";
      return `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)} (${sourceLabel})`;
    }

    if (locationError) return `Location unavailable: ${locationError}`;
    if (isRequestingLocation) return "Requesting location…";
    return "Location not requested yet.";
  }, [isRequestingLocation, location, locationError, source]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100dvh", minHeight: "100svh" }}>
      <SkyInstrument
        locationText={locationText}
        isRequestingLocation={isRequestingLocation}
        onRequestLocation={() => requestCurrentLocation(true)}
      />
    </div>
  );
}
