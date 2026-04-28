import { useEffect, useMemo, useState } from "react";
import type { CurrentWeatherSignalPayload } from "@technopeace/codex-data/types/SignalPayload";
import { useLocation } from "@technopeace/codex-map/src/useLocation";

const FALLBACK_COORDS = {
  lat: 40.7128,
  lon: -74.006,
};

const DEFAULT_SIGNAL: CurrentWeatherSignalPayload = {
  cloudCover: 0.35,
  windMps: 3.2,
  humidityPct: 58,
  sunAltitudeDeg: -24,
  moonPhase: 0.5,
  temperatureC: 18,
  isDay: false,
  latitude: FALLBACK_COORDS.lat,
  longitude: FALLBACK_COORDS.lon,
  altitudeM: 10,
  rainMm: 0,
  precipitationMm: 0,
  dailyRainMm: 0,
  showersMm: 0,
  status: "idle",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function estimateMoonPhase(date: Date) {
  const knownNewMoonUtcMs = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodicMonthMs = 29.530588853 * 24 * 60 * 60 * 1000;
  const elapsed = date.getTime() - knownNewMoonUtcMs;
  const normalized = ((elapsed % synodicMonthMs) + synodicMonthMs) % synodicMonthMs;
  return normalized / synodicMonthMs;
}

function estimateSunAltitude(nowIso: string, sunriseIso?: string, sunsetIso?: string) {
  if (!sunriseIso || !sunsetIso) return 0;

  const now = new Date(nowIso).getTime();
  const sunrise = new Date(sunriseIso).getTime();
  const sunset = new Date(sunsetIso).getTime();

  if (Number.isNaN(now) || Number.isNaN(sunrise) || Number.isNaN(sunset)) return 0;

  if (now >= sunrise && now <= sunset) {
    const daylightProgress = clamp((now - sunrise) / Math.max(sunset - sunrise, 1), 0, 1);
    return Math.sin(daylightProgress * Math.PI) * 90;
  }

  const nextSunrise = now < sunrise ? sunrise : sunrise + 24 * 60 * 60 * 1000;
  const lastSunset = now > sunset ? sunset : sunset - 24 * 60 * 60 * 1000;
  const nightSpan = Math.max(nextSunrise - lastSunset, 1);
  const nightProgress = clamp((now - lastSunset) / nightSpan, 0, 1);
  return -Math.sin(nightProgress * Math.PI) * 90;
}

export function useCurrentWeatherSignal() {
  const { location, error: locationError } = useLocation();
  const [signal, setSignal] = useState<CurrentWeatherSignalPayload>(DEFAULT_SIGNAL);

  const coords = useMemo(() => {
    if (location.lat !== 0 || location.lon !== 0) {
      return { lat: location.lat, lon: location.lon };
    }

    return FALLBACK_COORDS;
  }, [location.lat, location.lon]);

  useEffect(() => {
    const controller = new AbortController();
    let pollHandle: number | null = null;

    async function loadWeather() {
      setSignal((current) => ({
        ...current,
        latitude: coords.lat,
        longitude: coords.lon,
        status: current.status === "live" ? "live" : "loading",
      }));

      const query = new URLSearchParams({
        latitude: coords.lat.toString(),
        longitude: coords.lon.toString(),
        timezone: "auto",
        forecast_days: "1",
        current:
          "temperature_2m,cloud_cover,wind_speed_10m,relative_humidity_2m,is_day,precipitation,rain,showers",
        daily: "sunrise,sunset,precipitation_sum,rain_sum,showers_sum",
      });

      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`weather-http-${response.status}`);
        }

        const payload = await response.json();
        const currentWeather = payload.current ?? {};
        const daily = payload.daily ?? {};

        const currentTime =
          typeof currentWeather.time === "string" ? currentWeather.time : new Date().toISOString();
        const sunrise = daily.sunrise?.[0];
        const sunset = daily.sunset?.[0];

        setSignal({
          cloudCover: clamp((Number(currentWeather.cloud_cover) || 0) / 100, 0, 1),
          windMps: Math.max(Number(currentWeather.wind_speed_10m) || 0, 0) / 3.6,
          humidityPct: clamp(Number(currentWeather.relative_humidity_2m) || 0, 0, 100),
          sunAltitudeDeg: estimateSunAltitude(currentTime, sunrise, sunset),
          moonPhase: estimateMoonPhase(new Date(currentTime)),
          temperatureC: Number(currentWeather.temperature_2m) || 0,
          isDay: Boolean(currentWeather.is_day),
          latitude: coords.lat,
          longitude: coords.lon,
          altitudeM: Number(payload.elevation) || DEFAULT_SIGNAL.altitudeM,
          rainMm: Number(currentWeather.rain) || 0,
          precipitationMm: Number(currentWeather.precipitation) || 0,
          dailyRainMm: Number(daily.rain_sum?.[0]) || 0,
          showersMm: Number(currentWeather.showers) || 0,
          status: "live",
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setSignal((current) => ({
          ...current,
          sunAltitudeDeg: current.status === "live" ? current.sunAltitudeDeg : -24,
          isDay: current.status === "live" ? current.isDay : false,
          latitude: coords.lat,
          longitude: coords.lon,
          altitudeM: current.altitudeM || DEFAULT_SIGNAL.altitudeM,
          status: locationError ? "fallback" : "error",
        }));
      }
    }

    void loadWeather();
    pollHandle = window.setInterval(() => {
      void loadWeather();
    }, 90_000);

    return () => {
      controller.abort();
      if (pollHandle !== null) {
        window.clearInterval(pollHandle);
      }
    };
  }, [coords.lat, coords.lon, locationError]);

  return signal;
}
