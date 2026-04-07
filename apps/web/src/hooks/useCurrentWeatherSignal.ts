import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@technopeace/codex-map/src/useLocation";

export type WeatherSignal = {
  cloudCover: number;
  windMps: number;
  humidityPct: number;
  sunAltitudeDeg: number;
  moonPhase: number;
  temperatureC: number;
  isDay: boolean;
  latitude: number;
  longitude: number;
  rainMm: number;
  precipitationMm: number;
  dailyRainMm: number;
  showersMm: number;
  sunAzimuthDeg: number;
  moonAltitudeDeg: number;
  moonAzimuthDeg: number;
  signalModel: {
    location: {
      latitude: number;
      longitude: number;
      placeSeed: number;
      rootHz: number;
    };
    weather: {
      cloudCover: number;
      windMps: number;
      rainMm: number;
      showersMm: number;
      precipitationMm: number;
      temperatureC: number;
      humidityPct: number;
    };
    sun: {
      altitudeDeg: number;
      azimuthDeg: number;
      gain: number;
      overtoneOpen: number;
    };
    moon: {
      altitudeDeg: number;
      azimuthDeg: number;
      phase: number;
      gain: number;
      softness: number;
    };
    dailyProfile: {
      droneSpread: number;
      turbulence: number;
      warmthBias: number;
      textureBias: number;
    };
  };
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
  moonPhase: 0.5,
  temperatureC: 18,
  isDay: false,
  latitude: FALLBACK_COORDS.lat,
  longitude: FALLBACK_COORDS.lon,
  rainMm: 0,
  precipitationMm: 0,
  dailyRainMm: 0,
  showersMm: 0,
  sunAzimuthDeg: 180,
  moonAltitudeDeg: 28,
  moonAzimuthDeg: 320,
  signalModel: {
    location: {
      latitude: FALLBACK_COORDS.lat,
      longitude: FALLBACK_COORDS.lon,
      placeSeed: 0.42,
      rootHz: 110,
    },
    weather: {
      cloudCover: 0.35,
      windMps: 3.2,
      rainMm: 0,
      showersMm: 0,
      precipitationMm: 0,
      temperatureC: 18,
      humidityPct: 58,
    },
    sun: {
      altitudeDeg: -24,
      azimuthDeg: 180,
      gain: 0.2,
      overtoneOpen: 0.12,
    },
    moon: {
      altitudeDeg: 28,
      azimuthDeg: 320,
      phase: 0.5,
      gain: 0.45,
      softness: 0.5,
    },
    dailyProfile: {
      droneSpread: 0.5,
      turbulence: 0.4,
      warmthBias: 0.5,
      textureBias: 0.4,
    },
  },
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

function fractional(x: number) {
  return x - Math.floor(x);
}

function derivePlaceRootHz(latitude: number, longitude: number) {
  const seed = fractional(Math.sin(latitude * 12.9898 + longitude * 78.233) * 43758.5453);
  const modeSteps = [0, 2, 3, 5, 7, 10];
  const degree = modeSteps[Math.floor(seed * modeSteps.length)];
  const baseMidi = 45 + degree;
  return {
    seed,
    rootHz: 440 * Math.pow(2, (baseMidi - 69) / 12),
  };
}

function estimateSunAzimuth(nowIso: string, sunriseIso?: string, sunsetIso?: string) {
  if (!sunriseIso || !sunsetIso) return 180;
  const now = new Date(nowIso).getTime();
  const sunrise = new Date(sunriseIso).getTime();
  const sunset = new Date(sunsetIso).getTime();
  if (Number.isNaN(now) || Number.isNaN(sunrise) || Number.isNaN(sunset)) return 180;
  const dayProgress = clamp((now - sunrise) / Math.max(sunset - sunrise, 1), 0, 1);
  return 90 + dayProgress * 180;
}

function estimateMoonAltitude(sunAltitudeDeg: number, moonPhase: number) {
  return clamp(-sunAltitudeDeg * 0.78 + (moonPhase - 0.5) * 26, -90, 90);
}

function estimateMoonAzimuth(sunAzimuthDeg: number, moonPhase: number) {
  return (sunAzimuthDeg + 180 + moonPhase * 24) % 360;
}

function buildSignalModel(input: {
  latitude: number;
  longitude: number;
  cloudCover: number;
  windMps: number;
  rainMm: number;
  showersMm: number;
  precipitationMm: number;
  temperatureC: number;
  humidityPct: number;
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  moonAltitudeDeg: number;
  moonAzimuthDeg: number;
  moonPhase: number;
  dailyRainMm: number;
}) {
  const place = derivePlaceRootHz(input.latitude, input.longitude);
  const sunGain = clamp((input.sunAltitudeDeg + 15) / 105, 0.05, 1);
  const moonGain = clamp((input.moonAltitudeDeg + 12) / 102, 0.05, 1);
  const coldness = clamp((12 - input.temperatureC) / 34, 0, 1);
  const dailyProfile = {
    droneSpread: clamp(0.28 + input.cloudCover * 0.5 + input.dailyRainMm / 30, 0, 1),
    turbulence: clamp(0.2 + input.windMps / 12 + input.rainMm * 0.18, 0, 1),
    warmthBias: clamp(1 - coldness, 0, 1),
    textureBias: clamp(0.2 + input.humidityPct / 140 + input.precipitationMm / 10, 0, 1),
  };

  return {
    // place = body / root / ground drone
    location: {
      latitude: input.latitude,
      longitude: input.longitude,
      placeSeed: place.seed,
      rootHz: place.rootHz,
    },
    // weather = modulation controls, not the primary drone voice
    weather: {
      cloudCover: input.cloudCover,
      windMps: input.windMps,
      rainMm: input.rainMm,
      showersMm: input.showersMm,
      precipitationMm: input.precipitationMm,
      temperatureC: input.temperatureC,
      humidityPct: input.humidityPct,
    },
    // sun = always-on moving drone with altitude/azimuth behavior
    sun: {
      altitudeDeg: input.sunAltitudeDeg,
      azimuthDeg: input.sunAzimuthDeg,
      gain: sunGain,
      overtoneOpen: clamp(sunGain * 1.05, 0, 1),
    },
    // moon = always-on moving drone with altitude/phase behavior
    moon: {
      altitudeDeg: input.moonAltitudeDeg,
      azimuthDeg: input.moonAzimuthDeg,
      phase: input.moonPhase,
      gain: moonGain,
      softness: clamp(0.35 + (1 - Math.abs(input.moonPhase - 0.5) * 2) * 0.65, 0, 1),
    },
    dailyProfile,
  };
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

      // Open-Meteo plug-in point:
      // keep this request for weather + sunrise/sunset timing fields.
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
        const sunAltitudeDeg = estimateSunAltitude(currentTime, sunrise, sunset);
        // AstronomyAPI plug-in point:
        // replace these estimates with live sun/moon altitude+azimuth+phase values.
        const moonPhase = estimateMoonPhase(new Date(currentTime));
        const sunAzimuthDeg = estimateSunAzimuth(currentTime, sunrise, sunset);
        const moonAltitudeDeg = estimateMoonAltitude(sunAltitudeDeg, moonPhase);
        const moonAzimuthDeg = estimateMoonAzimuth(sunAzimuthDeg, moonPhase);
        const signalModel = buildSignalModel({
          latitude: coords.lat,
          longitude: coords.lon,
          cloudCover: clamp((Number(current.cloud_cover) || 0) / 100, 0, 1),
          windMps: Math.max(Number(current.wind_speed_10m) || 0, 0) / 3.6,
          humidityPct: clamp(Number(current.relative_humidity_2m) || 0, 0, 100),
          sunAltitudeDeg,
          sunAzimuthDeg,
          moonPhase,
          moonAltitudeDeg,
          moonAzimuthDeg,
          temperatureC: Number(current.temperature_2m) || 0,
          rainMm: Number(current.rain) || 0,
          precipitationMm: Number(current.precipitation) || 0,
          dailyRainMm: Number(daily.rain_sum?.[0]) || 0,
          showersMm: Number(current.showers) || 0,
        });

        setSignal({
          cloudCover: signalModel.weather.cloudCover,
          windMps: signalModel.weather.windMps,
          humidityPct: signalModel.weather.humidityPct,
          sunAltitudeDeg,
          moonPhase,
          temperatureC: Number(current.temperature_2m) || 0,
          isDay: Boolean(current.is_day),
          latitude: coords.lat,
          longitude: coords.lon,
          rainMm: Number(current.rain) || 0,
          precipitationMm: Number(current.precipitation) || 0,
          dailyRainMm: Number(daily.rain_sum?.[0]) || 0,
          showersMm: Number(current.showers) || 0,
          sunAzimuthDeg,
          moonAltitudeDeg,
          moonAzimuthDeg,
          signalModel,
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
          signalModel: buildSignalModel({
            latitude: coords.lat,
            longitude: coords.lon,
            cloudCover: current.cloudCover,
            windMps: current.windMps,
            humidityPct: current.humidityPct,
            sunAltitudeDeg: current.sunAltitudeDeg,
            sunAzimuthDeg: current.sunAzimuthDeg,
            moonPhase: current.moonPhase,
            moonAltitudeDeg: current.moonAltitudeDeg,
            moonAzimuthDeg: current.moonAzimuthDeg,
            temperatureC: current.temperatureC,
            rainMm: current.rainMm,
            precipitationMm: current.precipitationMm,
            dailyRainMm: current.dailyRainMm,
            showersMm: current.showersMm,
          }),
          status: locationError ? "fallback" : "error",
        }));
      }
    }

    void loadWeather();

    return () => controller.abort();
  }, [coords.lat, coords.lon, locationError]);

  return signal;
}
