import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@technopeace/codex-map/src/useLocation";

export type WeatherSignal = {
  cloudCover: number;
  windMps: number;
  humidityPct: number;
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  sunriseMs: number;
  sunsetMs: number;
  moonPhase: number;
  temperatureC: number;
  isDay: boolean;
  latitude: number;
  longitude: number;
  rainMm: number;
  precipitationMm: number;
  dailyRainMm: number;
  showersMm: number;
  status: "idle" | "loading" | "live" | "fallback" | "error";
};

const FALLBACK_COORDS = {
  lat: 40.7128,
  lon: -74.006,
};

const DEFAULT_SIGNAL: WeatherSignal = {
  cloudCover: 0.35,
  windMps: 3.2,
  humidityPct: 58,
  sunAltitudeDeg: -24,
  sunAzimuthDeg: 0,
  sunriseMs: 0,
  sunsetMs: 0,
  moonPhase: 0.5,
  temperatureC: 18,
  isDay: false,
  latitude: FALLBACK_COORDS.lat,
  longitude: FALLBACK_COORDS.lon,
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

function getDayProgress(nowMs: number, sunriseMs: number, sunsetMs: number) {
  if (!sunriseMs || !sunsetMs || sunsetMs <= sunriseMs) return 0;
  return clamp((nowMs - sunriseMs) / (sunsetMs - sunriseMs), 0, 1);
}

function estimateSunAzimuth(nowMs: number, sunriseMs: number, sunsetMs: number) {
  // TODO: replace with real solar azimuth from live astronomy/weather source when available.
  const dayProgress = getDayProgress(nowMs, sunriseMs, sunsetMs);
  return -90 + dayProgress * 180;
}

export function useCurrentWeatherSignal() {
  const { location, error: locationError } = useLocation();
  const [signal, setSignal] = useState<WeatherSignal>(DEFAULT_SIGNAL);

  const coords = useMemo(() => {
    if (location.lat !== 0 || location.lon !== 0) {
      return { lat: location.lat, lon: location.lon };
    }

    return FALLBACK_COORDS;
  }, [location.lat, location.lon]);

  useEffect(() => {
    const controller = new AbortController();

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
        const current = payload.current ?? {};
        const daily = payload.daily ?? {};

        const currentTime = typeof current.time === "string" ? current.time : new Date().toISOString();
        const sunrise = daily.sunrise?.[0];
        const sunset = daily.sunset?.[0];
        const sunriseMs = sunrise ? new Date(sunrise).getTime() : 0;
        const sunsetMs = sunset ? new Date(sunset).getTime() : 0;
        const currentMs = new Date(currentTime).getTime();

        setSignal({
          cloudCover: clamp((Number(current.cloud_cover) || 0) / 100, 0, 1),
          windMps: Math.max(Number(current.wind_speed_10m) || 0, 0) / 3.6,
          humidityPct: clamp(Number(current.relative_humidity_2m) || 0, 0, 100),
          sunAltitudeDeg: estimateSunAltitude(currentTime, sunrise, sunset),
          sunAzimuthDeg: estimateSunAzimuth(currentMs, sunriseMs, sunsetMs),
          sunriseMs,
          sunsetMs,
          moonPhase: estimateMoonPhase(new Date(currentTime)),
          temperatureC: Number(current.temperature_2m) || 0,
          isDay: Boolean(current.is_day),
          latitude: coords.lat,
          longitude: coords.lon,
          rainMm: Number(current.rain) || 0,
          precipitationMm: Number(current.precipitation) || 0,
          dailyRainMm: Number(daily.rain_sum?.[0]) || 0,
          showersMm: Number(current.showers) || 0,
          status: "live",
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setSignal((current) => ({
          ...current,
          sunAltitudeDeg: current.status === "live" ? current.sunAltitudeDeg : -24,
          sunAzimuthDeg: current.status === "live" ? current.sunAzimuthDeg : 0,
          sunriseMs: current.status === "live" ? current.sunriseMs : 0,
          sunsetMs: current.status === "live" ? current.sunsetMs : 0,
          isDay: current.status === "live" ? current.isDay : false,
          latitude: coords.lat,
          longitude: coords.lon,
          status: locationError ? "fallback" : "error",
        }));
      }
    }

    void loadWeather();

    return () => controller.abort();
  }, [coords.lat, coords.lon, locationError]);

  return signal;
}
