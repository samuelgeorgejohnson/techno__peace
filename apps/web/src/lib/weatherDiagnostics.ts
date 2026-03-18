export type DataSourceStatus = "live" | "cached" | "mocked";
export type FetchStatus = "idle" | "success" | "failure";

export interface WeatherSnapshot {
  locationName: string;
  latitude: number;
  longitude: number;
  timezone: string;
  currentTimeIso: string;
  dataTimestampIso: string;
  fetchedAtIso: string;
  temperatureC: number;
  humidityPct: number;
  windSpeedMps: number;
  cloudCoverPct: number;
  precipitationMm: number;
  rainMm: number;
  weatherCode: number;
  weatherDescription: string;
  sunriseIso?: string;
  sunsetIso?: string;
  sunAltitudeDeg?: number;
  sourceStatus: DataSourceStatus;
  locationSource: "geolocation" | "default";
  rawEndpoint: string;
  refreshIntervalMs: number;
  isMocked: boolean;
}

export interface WeatherDiagnosticsState {
  fetchStatus: FetchStatus;
  lastFetchTimeIso: string | null;
  errorMessage: string | null;
  weather: WeatherSnapshot;
}

export interface WeatherAudioMapping {
  windNoiseGain: number;
  windFilterLfo: number;
  lowpassCutoffHz: number;
  rainTextureGain: number;
  harmonicBrightness: number;
  thunderEnabled: boolean;
  sunLfoRateHz: number;
  masterGain: number;
  baseFrequencyHz: number;
  waterLayerGain: number;
  stormIntensity: number;
  activeWeatherDrivenChannels: number;
}

export const WEATHER_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
export const WEATHER_CACHE_KEY = "technopeace.weatherDiagnostics.v1";

const DEFAULT_COORDS = {
  latitude: 40.7128,
  longitude: -74.006,
  locationName: "Default location (New York City)",
};

const WMO_DESCRIPTION: Record<number, string> = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "depositing rime fog",
  51: "light drizzle",
  53: "moderate drizzle",
  55: "dense drizzle",
  56: "light freezing drizzle",
  57: "dense freezing drizzle",
  61: "slight rain",
  63: "moderate rain",
  65: "heavy rain",
  66: "light freezing rain",
  67: "heavy freezing rain",
  71: "slight snow fall",
  73: "moderate snow fall",
  75: "heavy snow fall",
  77: "snow grains",
  80: "slight rain showers",
  81: "moderate rain showers",
  82: "violent rain showers",
  85: "slight snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm with slight hail",
  99: "thunderstorm with heavy hail",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function resolveWeatherDescription(code: number) {
  return WMO_DESCRIPTION[code] ?? `code ${code}`;
}

export function createMockWeather(now = new Date()): WeatherSnapshot {
  const currentTimeIso = now.toISOString();
  const sunrise = new Date(now);
  sunrise.setUTCHours(11, 15, 0, 0);
  const sunset = new Date(now);
  sunset.setUTCHours(23, 5, 0, 0);

  return {
    locationName: `${DEFAULT_COORDS.locationName} (mocked)`,
    latitude: DEFAULT_COORDS.latitude,
    longitude: DEFAULT_COORDS.longitude,
    timezone: "UTC",
    currentTimeIso,
    dataTimestampIso: currentTimeIso,
    fetchedAtIso: currentTimeIso,
    temperatureC: 16,
    humidityPct: 72,
    windSpeedMps: 5.2,
    cloudCoverPct: 64,
    precipitationMm: 0.4,
    rainMm: 0.3,
    weatherCode: 63,
    weatherDescription: resolveWeatherDescription(63),
    sunriseIso: sunrise.toISOString(),
    sunsetIso: sunset.toISOString(),
    sunAltitudeDeg: 14,
    sourceStatus: "mocked",
    locationSource: "default",
    rawEndpoint: "mock://technopeace/weather-diagnostics",
    refreshIntervalMs: WEATHER_REFRESH_INTERVAL_MS,
    isMocked: true,
  };
}

export function computeSunAltitudeDeg(
  currentTimeIso: string,
  sunriseIso?: string,
  sunsetIso?: string
): number | undefined {
  if (!sunriseIso || !sunsetIso) return undefined;

  const current = new Date(currentTimeIso).getTime();
  const sunrise = new Date(sunriseIso).getTime();
  const sunset = new Date(sunsetIso).getTime();

  if (!Number.isFinite(current) || !Number.isFinite(sunrise) || !Number.isFinite(sunset)) {
    return undefined;
  }

  if (current <= sunrise || current >= sunset) {
    return -12;
  }

  const progress = (current - sunrise) / (sunset - sunrise);
  return Math.sin(progress * Math.PI) * 70;
}

export function mapWeatherToAudio(snapshot: WeatherSnapshot): WeatherAudioMapping {
  const windNorm = clamp(snapshot.windSpeedMps / 12, 0, 1);
  const cloudNorm = clamp(snapshot.cloudCoverPct / 100, 0, 1);
  const humidityNorm = clamp(snapshot.humidityPct / 100, 0, 1);
  const rainNorm = clamp((snapshot.precipitationMm + snapshot.rainMm) / 6, 0, 1);
  const tempNorm = clamp((snapshot.temperatureC + 10) / 40, 0, 1);
  const sunNorm = clamp(((snapshot.sunAltitudeDeg ?? -12) + 12) / 82, 0, 1);
  const stormNorm = clamp(Math.max(rainNorm, windNorm * 0.75, snapshot.weatherCode >= 95 ? 1 : 0), 0, 1);

  const windNoiseGain = 0.04 + windNorm * 0.28;
  const windFilterLfo = 0.08 + windNorm * 0.72;
  const lowpassCutoffHz = 700 + (1 - cloudNorm * 0.65 + sunNorm * 0.35) * 2600;
  const rainTextureGain = 0.02 + Math.max(rainNorm, humidityNorm * 0.35) * 0.32;
  const harmonicBrightness = clamp(0.2 + tempNorm * 0.35 + sunNorm * 0.45 - cloudNorm * 0.2, 0, 1);
  const thunderEnabled = snapshot.weatherCode >= 95 || stormNorm > 0.72;
  const sunLfoRateHz = 0.05 + sunNorm * 0.55;
  const masterGain = 0.05 + humidityNorm * 0.05 + windNorm * 0.03;
  const baseFrequencyHz = 75 + tempNorm * 50 + (1 - cloudNorm) * 22;
  const waterLayerGain = 0.03 + clamp(humidityNorm * 0.18 + rainNorm * 0.24, 0, 0.3);

  const activeWeatherDrivenChannels = [
    true,
    windNoiseGain > 0.06,
    rainTextureGain > 0.08,
    thunderEnabled,
    waterLayerGain > 0.08,
  ].filter(Boolean).length;

  return {
    windNoiseGain,
    windFilterLfo,
    lowpassCutoffHz,
    rainTextureGain,
    harmonicBrightness,
    thunderEnabled,
    sunLfoRateHz,
    masterGain,
    baseFrequencyHz,
    waterLayerGain,
    stormIntensity: stormNorm,
    activeWeatherDrivenChannels,
  };
}

export function buildOpenMeteoUrl(latitude: number, longitude: number) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude.toFixed(4));
  url.searchParams.set("longitude", longitude.toFixed(4));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "rain",
      "cloud_cover",
      "wind_speed_10m",
      "weather_code",
    ].join(",")
  );
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");
  return url.toString();
}

interface OpenMeteoResponse {
  timezone?: string;
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    rain: number;
    cloud_cover: number;
    wind_speed_10m: number;
    weather_code: number;
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
  };
}

export function normalizeOpenMeteoResponse(args: {
  payload: OpenMeteoResponse;
  latitude: number;
  longitude: number;
  locationName: string;
  locationSource: "geolocation" | "default";
  sourceStatus: DataSourceStatus;
  rawEndpoint: string;
  fetchedAtIso: string;
}): WeatherSnapshot {
  const current = args.payload.current;
  const now = args.fetchedAtIso;

  if (!current) {
    const mock = createMockWeather(new Date(now));
    return {
      ...mock,
      locationName: `${args.locationName} (mocked fallback)`,
      latitude: args.latitude,
      longitude: args.longitude,
      locationSource: args.locationSource,
      rawEndpoint: args.rawEndpoint,
    };
  }

  const currentTimeIso = new Date(current.time).toISOString();
  const sunriseIso = args.payload.daily?.sunrise?.[0]
    ? new Date(args.payload.daily.sunrise[0]).toISOString()
    : undefined;
  const sunsetIso = args.payload.daily?.sunset?.[0]
    ? new Date(args.payload.daily.sunset[0]).toISOString()
    : undefined;

  return {
    locationName: args.locationName,
    latitude: args.latitude,
    longitude: args.longitude,
    timezone: args.payload.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    currentTimeIso,
    dataTimestampIso: currentTimeIso,
    fetchedAtIso: args.fetchedAtIso,
    temperatureC: current.temperature_2m,
    humidityPct: current.relative_humidity_2m,
    windSpeedMps: current.wind_speed_10m,
    cloudCoverPct: current.cloud_cover,
    precipitationMm: current.precipitation,
    rainMm: current.rain,
    weatherCode: current.weather_code,
    weatherDescription: resolveWeatherDescription(current.weather_code),
    sunriseIso,
    sunsetIso,
    sunAltitudeDeg: computeSunAltitudeDeg(currentTimeIso, sunriseIso, sunsetIso),
    sourceStatus: args.sourceStatus,
    locationSource: args.locationSource,
    rawEndpoint: args.rawEndpoint,
    refreshIntervalMs: WEATHER_REFRESH_INTERVAL_MS,
    isMocked: args.sourceStatus === "mocked",
  };
}

export function getDefaultLocation() {
  return DEFAULT_COORDS;
}
