import type { CelestialMixerState } from "./CelestialSignals";
import type { AirSignal, TrafficSignal } from "./ManMadeSignals";
import type { ManMadeSignals } from "./ManMadeSignals";

export type SignalStatus = "idle" | "loading" | "live" | "fallback" | "error";

/**
 * Shared weather + place payload currently used by the web signal chain.
 */
export interface CurrentWeatherSignalPayload {
  cloudCover: number;
  windMps: number;
  humidityPct: number;
  sunAltitudeDeg: number;
  moonPhase: number;
  temperatureC: number;
  isDay: boolean;
  latitude: number;
  longitude: number;
  altitudeM: number;
  rainMm: number;
  precipitationMm: number;
  dailyRainMm: number;
  showersMm: number;
  status: SignalStatus;
}

/**
 * Engine-facing payload built from pointer input + current weather/place data.
 */
export type AudioEngineSignalPayload = Omit<CurrentWeatherSignalPayload, "status"> & {
  x: number;
  y: number;
  pressure: number;
  sunLevel: number;
  moonLevel: number;
  birdsLevel?: number;
  chimesLevel?: number;
  airMix?: number;
  air?: AirSignal | null;
  trafficMix?: number;
  traffic?: TrafficSignal | null;
};

/**
 * Shared server payload shape returned by `/signals`.
 */
export interface ServerSignalsPayload {
  coordinates: {
    lat: number;
    lon: number;
  };
  manMade: {
    air: ManMadeSignals["air"] | null;
    road: ManMadeSignals["road"] | null;
  };
  meta: {
    airStatus: "live" | "unavailable";
    roadStatus: "live" | "unavailable";
    airError?: string;
    roadError?: string;
  };
}

/**
 * Optional mixer controls bundled with the shared payload when needed.
 */
export interface WeatherSignalMixState {
  celestial: CelestialMixerState;
}
