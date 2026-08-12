import type { CelestialMixerState } from "./CelestialSignals";
import type { AirSignal } from "./ManMadeSignals";
import type { ManMadeSignals } from "./ManMadeSignals";

export type SignalStatus = "idle" | "loading" | "live" | "fallback" | "error";

export type ChaosLaneId = "kick" | "bass" | "hat";

export interface ChaosStepState {
  on: boolean;
  accent?: boolean;
}

export type ChaosPattern = Record<ChaosLaneId, ChaosStepState[]>;

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
  placeDroneLevel?: number;
  air?: AirSignal | null;
  road?: ManMadeSignals["road"] | null;
  performanceMode?: "sky" | "chaos";
  chaosTempoBpm?: number;
  trafficReliable?: boolean;
  chaosPattern?: ChaosPattern;
  pulseLock?: boolean;
  holdChaos?: boolean;
  skyHold?: boolean;
  skyVoices?: Array<{ x: number; y: number; pressure: number }>;
  /** Latched Sky voices, kept independent from the currently selected performance mode. */
  heldSkyVoices?: Array<{ x: number; y: number; pressure: number; frequencyHz?: number }>;
  /** Oldest latched Sky pitch used as Chaos's tonic; other held voices remain harmony. */
  heldSkyReferenceHz?: number;
  /** Stable Chaos tonic captured on entry, independent of subsequent live Sky gestures. */
  chaosReferenceHz?: number;
  /** Exact live Sky pitch, retained while the Chaos pointer uses its own X domain. */
  liveSkyPitchHz?: number;
  /** Whether a performer gesture has intentionally selected a Chaos playable note. */
  chaosVoiceActive?: boolean;
  /** Performance transpose relative to the unchanged place-derived tonic. */
  octaveShift?: -2 | -1 | 0 | 1 | 2;
  /** Diatonic degree across the Chaos surface (0-13 = two octaves). */
  chaosScaleDegree?: number;
  /** Ordered diatonic degrees selected for the sequenced Chaos bass. */
  chaosBassSequence?: number[];
  kickPitchSemitones?: number;
  hatPitchSemitones?: number;
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
