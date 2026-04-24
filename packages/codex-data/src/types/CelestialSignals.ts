/**
 * Normalized signal shape shared by all celestial bodies.
 */
export interface CelestialSignalLayer {
  /** 0–1 how audible/present the body should be. */
  presence: number;
  /** 0–1 how much movement is implied. */
  motion: number;
  /** 0–1 perceptual brightness of the body signal. */
  brightness: number;
  /** -1 to 1 pan/spatial drift bias. */
  spatialBias: number;
  /** 0–1 depth of modulation to apply. */
  modulationDepth: number;
  /** 0–1 harmonic intensity/instability. */
  tension: number;
}

/**
 * Sun-specific source signal plus normalized rendering layer values.
 */
export interface SunSignal {
  altitudeDeg: number;
  azimuthDeg: number;
  sunriseISO?: string;
  sunsetISO?: string;
  /** 0–1 daylight progress. */
  dayProgress?: number;
  isDay?: boolean;
  normalized: CelestialSignalLayer;
}

/**
 * Moon-specific source signal plus normalized rendering layer values.
 */
export interface MoonSignal {
  altitudeDeg: number;
  azimuthDeg: number;
  /** 0–1 lunar phase progress. */
  phase?: number;
  visible?: boolean;
  /** Optional 0–1 lunar illumination. */
  illumination?: number;
  normalized: CelestialSignalLayer;
}

/**
 * Top-level container for available celestial body signals.
 */
export interface CelestialSignals {
  sun?: SunSignal;
  moon?: MoonSignal;
}

/**
 * Mixer-oriented gain controls for celestial channels.
 */
export interface CelestialMixerState {
  master?: number;
  sun?: number;
  moon?: number;
}
