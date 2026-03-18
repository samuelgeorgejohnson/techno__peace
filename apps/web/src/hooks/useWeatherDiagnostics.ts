import { useCallback, useEffect, useMemo, useState } from "react";
import {
  WEATHER_CACHE_KEY,
  WEATHER_REFRESH_INTERVAL_MS,
  buildOpenMeteoUrl,
  computeSunAltitudeDeg,
  createMockWeather,
  getDefaultLocation,
  mapWeatherToAudio,
  normalizeOpenMeteoResponse,
  type WeatherAudioMapping,
  type WeatherDiagnosticsState,
  type WeatherSnapshot,
} from "../lib/weatherDiagnostics";

interface GeolocationState {
  latitude: number;
  longitude: number;
  locationName: string;
  locationSource: "geolocation" | "default";
}

function readCachedWeather(): WeatherSnapshot | null {
  const raw = window.localStorage.getItem(WEATHER_CACHE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as WeatherSnapshot;
  } catch {
    return null;
  }
}

export function useWeatherDiagnostics() {
  const [geo, setGeo] = useState<GeolocationState>(() => {
    const fallback = getDefaultLocation();
    return {
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      locationName: fallback.locationName,
      locationSource: "default",
    };
  });

  const [state, setState] = useState<WeatherDiagnosticsState>(() => ({
    fetchStatus: "idle",
    lastFetchTimeIso: null,
    errorMessage: null,
    weather: createMockWeather(),
  }));

  const [clockIso, setClockIso] = useState(() => new Date().toISOString());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockIso(new Date().toISOString());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          locationName: "Current device location",
          locationSource: "geolocation",
        });
      },
      () => {
        setGeo((current) => ({
          ...current,
          locationName: `${current.locationName} (geolocation unavailable)`,
        }));
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
    );
  }, []);

  const fetchWeather = useCallback(async () => {
    const fetchedAtIso = new Date().toISOString();
    const rawEndpoint = buildOpenMeteoUrl(geo.latitude, geo.longitude);

    setState((current) => ({
      ...current,
      fetchStatus: current.weather.isMocked ? "idle" : current.fetchStatus,
      errorMessage: null,
    }));

    try {
      const response = await fetch(rawEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const normalized = normalizeOpenMeteoResponse({
        payload,
        latitude: geo.latitude,
        longitude: geo.longitude,
        locationName: geo.locationName,
        locationSource: geo.locationSource,
        sourceStatus: "live",
        rawEndpoint,
        fetchedAtIso,
      });

      window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(normalized));

      setState({
        fetchStatus: "success",
        lastFetchTimeIso: fetchedAtIso,
        errorMessage: null,
        weather: normalized,
      });
    } catch (error) {
      const cached = readCachedWeather();
      if (cached) {
        setState({
          fetchStatus: "failure",
          lastFetchTimeIso: fetchedAtIso,
          errorMessage: error instanceof Error ? error.message : "Weather request failed",
          weather: {
            ...cached,
            sourceStatus: "cached",
            fetchedAtIso,
            locationName: geo.locationName,
            latitude: geo.latitude,
            longitude: geo.longitude,
            locationSource: geo.locationSource,
            rawEndpoint,
          },
        });
        return;
      }

      const mocked = createMockWeather(new Date(fetchedAtIso));
      setState({
        fetchStatus: "failure",
        lastFetchTimeIso: fetchedAtIso,
        errorMessage: error instanceof Error ? error.message : "Weather request failed",
        weather: {
          ...mocked,
          locationName: `${geo.locationName} (mocked fallback)`,
          latitude: geo.latitude,
          longitude: geo.longitude,
          locationSource: geo.locationSource,
          rawEndpoint,
        },
      });
    }
  }, [geo]);

  useEffect(() => {
    void fetchWeather();
    const timer = window.setInterval(() => {
      void fetchWeather();
    }, WEATHER_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [fetchWeather]);

  const effectiveWeather = useMemo(() => ({
    ...state.weather,
    currentTimeIso: clockIso,
    sunAltitudeDeg:
      computeSunAltitudeDeg(clockIso, state.weather.sunriseIso, state.weather.sunsetIso) ??
      state.weather.sunAltitudeDeg,
  }), [clockIso, state.weather]);

  const mapping: WeatherAudioMapping = useMemo(
    () => mapWeatherToAudio(effectiveWeather),
    [effectiveWeather]
  );

  return {
    state: { ...state, weather: effectiveWeather },
    mapping,
    refreshWeather: fetchWeather,
    refreshIntervalMs: WEATHER_REFRESH_INTERVAL_MS,
    setLocationOverride: (latitude: number, longitude: number, locationName = "Manual location") => {
      setGeo({ latitude, longitude, locationName, locationSource: "default" });
    },
  };
}
