import { useEffect, useState } from "react";
import type { LocationBundle } from "./LocationBundle";

const defaultBundle: LocationBundle = {
  lat: 0,
  lon: 0,
  date: new Date().toISOString().slice(0, 10),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export const useLocation = () => {
  const [location, setLocation] = useState<LocationBundle>(defaultBundle);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("geolocation-unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation((current) => ({
          ...current,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          altitude: pos.coords.altitude ?? current.altitude,
        }));
      },
      () => setError("geolocation-denied"),
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );
  }, []);

  return { location, setLocation, error } as const;
};
