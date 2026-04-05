import { useEffect, useMemo, useState } from "react";
import type { LocationBundle } from "../../../../packages/codex-map/src/LocationBundle";

export type WeatherSnapshot = {
  temperatureC: number;
  precipitationMm: number;
  rainMm: number;
  dailyRainMm: number;
  humidityPct: number;
  windSpeedMps: number;
  windDirectionDeg: number;
  sampleTime: string;
  source: "current" | "hourly";
};

type WeatherApiResponse = {
  current?: {
    time: string;
    temperature_2m: number;
    precipitation: number;
    rain: number;
    showers: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    rain: number[];
    showers: number[];
    relative_humidity_2m: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
  };
  daily?: {
    time: string[];
    precipitation_sum: number[];
    rain_sum: number[];
    showers_sum: number[];
  };
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pickNearestHourly(
  hourly: WeatherApiResponse["hourly"],
  nowIso: string,
  dailyRainMm: number
): WeatherSnapshot | null {
  if (!hourly) return null;

  const { time, temperature_2m, precipitation, rain, relative_humidity_2m, wind_speed_10m, wind_direction_10m } = hourly;
  if (!time?.length) return null;

  const target = new Date(nowIso).getTime();
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < time.length; i += 1) {
    const distance = Math.abs(new Date(time[i]).getTime() - target);
    if (distance < bestDistance) {
      bestIndex = i;
      bestDistance = distance;
    }
  }

  const temperatureC = temperature_2m?.[bestIndex];
  const precipitationMm = precipitation?.[bestIndex];
  const rainMm = rain?.[bestIndex];
  const humidityPct = relative_humidity_2m?.[bestIndex];
  const windSpeedMps = wind_speed_10m?.[bestIndex];
  const windDirectionDeg = wind_direction_10m?.[bestIndex];

  if (
    !isFiniteNumber(temperatureC) ||
    !isFiniteNumber(precipitationMm) ||
    !isFiniteNumber(rainMm) ||
    !isFiniteNumber(humidityPct) ||
    !isFiniteNumber(windSpeedMps) ||
    !isFiniteNumber(windDirectionDeg)
  ) {
    return null;
  }

  return {
    temperatureC,
    precipitationMm,
    rainMm,
    dailyRainMm,
    humidityPct,
    windSpeedMps,
    windDirectionDeg,
    sampleTime: time[bestIndex],
    source: "hourly",
  };
}

export function useWeatherSignal(location: LocationBundle) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeCursor, setTimeCursor] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setTimeCursor(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return;
    if (Math.abs(location.lat) < 0.001 && Math.abs(location.lon) < 0.001) return;

    const controller = new AbortController();

    async function loadWeather() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          latitude: location.lat.toFixed(4),
          longitude: location.lon.toFixed(4),
          current: [
            "temperature_2m",
            "precipitation",
            "rain",
            "showers",
            "relative_humidity_2m",
            "wind_speed_10m",
            "wind_direction_10m",
          ].join(","),
          hourly: [
            "temperature_2m",
            "precipitation",
            "rain",
            "showers",
            "relative_humidity_2m",
            "wind_speed_10m",
            "wind_direction_10m",
          ].join(","),
          daily: ["precipitation_sum", "rain_sum", "showers_sum"].join(","),
          forecast_days: "1",
          wind_speed_unit: "ms",
          timezone: location.timezone || "auto",
        });

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`weather-http-${response.status}`);
        }

        const data = (await response.json()) as WeatherApiResponse;
        const dailyRainMm = Number(data.daily?.rain_sum?.[0]) || 0;

        const current = data.current;
        if (
          current &&
          isFiniteNumber(current.temperature_2m) &&
          isFiniteNumber(current.precipitation) &&
          isFiniteNumber(current.rain) &&
          isFiniteNumber(current.relative_humidity_2m) &&
          isFiniteNumber(current.wind_speed_10m) &&
          isFiniteNumber(current.wind_direction_10m)
        ) {
          setWeather({
            temperatureC: current.temperature_2m,
            precipitationMm: current.precipitation,
            rainMm: Number(current.rain) || 0,
            dailyRainMm,
            humidityPct: current.relative_humidity_2m,
            windSpeedMps: current.wind_speed_10m,
            windDirectionDeg: current.wind_direction_10m,
            sampleTime: current.time,
            source: "current",
          });
          return;
        }

        const fallback = pickNearestHourly(data.hourly, new Date().toISOString(), dailyRainMm);
        if (fallback) {
          setWeather(fallback);
          return;
        }

        throw new Error("weather-empty");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "weather-fetch-failed");
      } finally {
        setIsLoading(false);
      }
    }

    void loadWeather();
    const refresh = window.setInterval(() => {
      void loadWeather();
    }, 10 * 60_000);

    return () => {
      controller.abort();
      window.clearInterval(refresh);
    };
  }, [location.lat, location.lon, location.timezone]);

  const droneSeed = useMemo(() => {
    const dayMillis = 24 * 60 * 60 * 1000;
    const dayPhase = ((timeCursor % dayMillis) / dayMillis) * Math.PI * 2;
    const lonPhase = (location.lon / 180) * Math.PI;
    const latPhase = (location.lat / 90) * (Math.PI / 2);

    return {
      coordinatePhase: Math.sin(dayPhase + lonPhase),
      latInfluence: Math.cos(latPhase),
      rotationPhase: Math.cos(dayPhase * 0.5 + latPhase),
    };
  }, [location.lat, location.lon, timeCursor]);

  return { weather, isLoading, error, droneSeed } as const;
}
