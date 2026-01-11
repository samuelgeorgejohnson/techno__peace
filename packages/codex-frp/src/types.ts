export type HourlySignal = {
  hour: number; // 0–23
  cloudCover: number; // 0–1
  windMps: number; // meters/sec
  humidity?: number; // 0–1 (optional)
  pressureHpa?: number; // optional
  tempC?: number; // optional
  sunAltitudeDeg?: number; // optional if you compute it elsewhere
  moonPhase?: number; // 0–1 (optional)
};

export type PlaceContext = {
  lat: number;
  lon: number;
  elevationM?: number;
  name?: string;
};

export type FRPParams = {
  // “place anchor”
  baseHz: number;

  // harmonic structure / “solar” coloration
  solarHarmHz: number;
  harmonicSpread: number; // 0–1 how wide the partials feel

  // “perception filters”
  brightness: number; // 0–1
  turbulence: number; // 0–1 (wind/instability)
  density: number; // 0–1 (humidity/pressure-ish)

  // modulation engine
  lfoRateHz: number;
  lfoDepth: number;

  // timbral control (audio + visual can share)
  lowpassHz: number;
  reverbMix: number;

  // visual primitives
  ringIntensity: number; // 0–1
  hueShift: number; // -1..+1 (abstract “sky color” knob)
};
