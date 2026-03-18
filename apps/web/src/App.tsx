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
      <SkyInstrument />

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          maxWidth: "min(420px, calc(100vw - 32px))",
          padding: "12px 14px",
          borderRadius: 14,
          background: "rgba(0,0,0,0.42)",
          border: "1px solid rgba(255,255,255,0.14)",
          color: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(8px)",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.45,
          zIndex: 2,
        }}
      >
        <div style={{ marginBottom: 8, letterSpacing: "0.06em", fontWeight: 700 }}>GEOLOCATION</div>
        <div style={{ marginBottom: 10, opacity: 0.9 }}>{locationText}</div>
        <button
          onClick={requestLocation}
          disabled={isRequestingLocation}
          style={{
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            padding: "8px 10px",
            cursor: isRequestingLocation ? "wait" : "pointer",
          }}
        >
          {isRequestingLocation ? "Requesting..." : "Request location"}
        </button>
      </div>
    </div>
  );
}
