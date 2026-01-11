import { HourlySignal, PlaceContext, FRPParams } from "./types";

/** linear interpolation */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** clamp */
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

/**
 * Simple “place anchor” — placeholder until your deeper equation set is wired in.
 * You can later swap this for your full FRP equation without changing downstream code.
 */
function computeBaseHz(place: PlaceContext): number {
  // Stable, deterministic number from lat/lon (NOT “physics”, just a repeatable anchor).
  // Replace with your FRP equation once finalized.
  const seed = Math.abs(place.lat * 1000) + Math.abs(place.lon * 1000);
  const base = 55 + (seed % 55); // 55–110-ish
  return base;
}

function getSignalAtHour(signals: HourlySignal[], hourInt: number): HourlySignal {
  const s = signals.find((x) => x.hour === hourInt);
  // fallback: if missing, return something safe
  return s ?? { hour: hourInt, cloudCover: 0.3, windMps: 2 };
}

/**
 * Compute a resonance profile at fractional time (e.g., 14.25 hours).
 * This is your shared “spine” used by audio + visuals.
 */
export function computeFRP(
  place: PlaceContext,
  signals: HourlySignal[],
  timeOfDayHours: number
): FRPParams {
  const h0 = Math.floor(timeOfDayHours);
  const h1 = (h0 + 1) % 24;
  const t = timeOfDayHours - h0;

  const s0 = getSignalAtHour(signals, h0);
  const s1 = getSignalAtHour(signals, h1);

  const cloud = clamp(lerp(s0.cloudCover, s1.cloudCover, t), 0, 1);
  const wind = Math.max(0, lerp(s0.windMps, s1.windMps, t));
  const humidity = clamp(
    lerp(s0.humidity ?? 0.55, s1.humidity ?? 0.55, t),
    0,
    1
  );
  const moon = clamp(lerp(s0.moonPhase ?? 0.5, s1.moonPhase ?? 0.5, t), 0, 1);

  // If you have sunAltitudeDeg from API, use it; otherwise approximate a daylight sine.
  const sunAlt0 =
    s0.sunAltitudeDeg ?? (90 * Math.sin(((h0 - 6) / 24) * 2 * Math.PI));
  const sunAlt1 =
    s1.sunAltitudeDeg ?? (90 * Math.sin(((h1 - 6) / 24) * 2 * Math.PI));
  const sunAlt = lerp(sunAlt0, sunAlt1, t);

  const brightness = clamp((sunAlt + 6) / 96, 0.05, 1);
  const turbulence = clamp(wind / 15, 0, 1);
  const density = clamp(0.35 + 0.65 * humidity, 0, 1);

  const baseHz = computeBaseHz(place);
  const solarHarmHz = baseHz * 3.18; // placeholder; you can tie to actual solar harmonic logic

  // Shared “filters”
  const lowpassHz = clamp(500 + 2500 * brightness + 800 * turbulence, 200, 6000);
  const reverbMix = clamp(0.2 + 0.7 * humidity, 0, 1);

  // Modulation: wind drives rate; moon drives depth
  const lfoRateHz = clamp(0.05 + 0.35 * turbulence, 0.05, 2);
  const lfoDepth = clamp(0.02 + 0.28 * moon, 0, 0.6);

  // Visual knobs
  const ringIntensity = clamp((1 - cloud) * (0.5 + 0.5 * brightness), 0, 1);
  const hueShift = clamp(
    (brightness - 0.5) + (turbulence - 0.3) * 0.2,
    -1,
    1
  );

  const harmonicSpread = clamp(
    0.15 + 0.65 * turbulence + 0.2 * (1 - cloud),
    0,
    1
  );

  return {
    baseHz,
    solarHarmHz,
    harmonicSpread,
    brightness,
    turbulence,
    density,
    lfoRateHz,
    lfoDepth,
    lowpassHz,
    reverbMix,
    ringIntensity,
    hueShift
  };
}
