import { useCallback, useEffect, useState } from "react";
import type { LocationBundle } from "./LocationBundle";

type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable";

const defaultBundle: LocationBundle = {
  lat: 0,
  lon: 0,
  date: new Date().toISOString().slice(0, 10),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export const useLocation = () => {
  const [location, setLocation] = useState<LocationBundle>(defaultBundle);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setError("geolocation-unavailable");
      return;
    }

    setStatus("requesting");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation((current) => ({
          ...current,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          altitude: pos.coords.altitude ?? current.altitude,
        }));
        setStatus("granted");
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setStatus("denied");
          setError("geolocation-denied");
          return;
        }

        setStatus("idle");
        setError("geolocation-unresolved");
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 12_000 }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => undefined;

    async function primeLocationPrompt() {
      if (!navigator.geolocation) {
        setStatus("unavailable");
        setError("geolocation-unavailable");
        return;
      }

      if (!navigator.permissions?.query) {
        requestLocation();
        return;
      }

      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (cancelled) return;

        const syncPermissionState = () => {
          if (permission.state === "granted") {
            setStatus("granted");
            requestLocation();
            return;
          }

          if (permission.state === "denied") {
            setStatus("denied");
            setError("geolocation-denied");
            return;
          }

          setStatus("idle");
          setError(null);
          if (document.visibilityState === "visible") {
            requestLocation();
          }
        };

        syncPermissionState();
        permission.onchange = syncPermissionState;

        const onVisible = () => {
          if (document.visibilityState !== "visible") return;
          if (permission.state === "prompt") {
            requestLocation();
          }
        };

        document.addEventListener("visibilitychange", onVisible);
        cleanup = () => {
          permission.onchange = null;
          document.removeEventListener("visibilitychange", onVisible);
        };
      } catch {
        requestLocation();
      }
    }

    void primeLocationPrompt();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [requestLocation]);

  return { location, setLocation, error, status, requestLocation } as const;
};
