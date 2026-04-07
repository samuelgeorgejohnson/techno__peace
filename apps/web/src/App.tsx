import { useEffect, useMemo, useState } from "react";
import SkyInstrument from "./components/SkyInstrument";

export default function App() {
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation not supported in this browser.");
      return;
    }

    setIsRequestingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(pos);
        setIsRequestingLocation(false);
      },
      (err) => {
        setLocationError(err.message);
        setIsRequestingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const locationText = useMemo(() => {
    if (location) {
      return `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`;
    }

    if (locationError) {
      return `Location unavailable: ${locationError}`;
    }

    if (isRequestingLocation) {
      return "Requesting location…";
    }

    return "Location not requested yet.";
  }, [isRequestingLocation, location, locationError]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <SkyInstrument
        locationText={locationText}
        isRequestingLocation={isRequestingLocation}
        onRequestLocation={requestLocation}
      />
    </div>
  );
}
