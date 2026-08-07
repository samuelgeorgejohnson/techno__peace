export interface ReflectResponse {
  mood: string;
  modulation: {
    tone: number;
    lfoRate: number;
    filterShift: number;
  };
}

export interface ResonanceInput {
  sunAltitude: number;
  moonPhase: number;
  baseLfoRate: number;
}

export interface ResonanceUiState {
  animationSpeed: number;
  interactionLatency: number;
  theme: "day-bright" | "night-muted";
}

export interface ResonanceState {
  lfoRate: number;
  lfoDepth: number;
  ui: ResonanceUiState;
}

const NIGHT_SUN_ALTITUDE_THRESHOLD = 0;
const DAY_LFO_MULTIPLIER = 1;
const NIGHT_LFO_MULTIPLIER = 0.6; // In the required 0.5–0.7 slow-night range.

const MIN_MOON_PHASE = 0;
const MAX_MOON_PHASE = 1;
const MIN_LFO_DEPTH = 0.2;
const MAX_LFO_DEPTH = 1;

const DAY_ANIMATION_SPEED = 1;
const NIGHT_ANIMATION_SPEED = 0.7;
const DAY_INTERACTION_LATENCY_MS = 0;
const NIGHT_INTERACTION_LATENCY_MS = 70;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const isNightMode = (sunAltitude: number): boolean => sunAltitude < NIGHT_SUN_ALTITUDE_THRESHOLD;

const computeLfoRate = (baseLfoRate: number, nightMode: boolean): number => {
  const multiplier = nightMode ? NIGHT_LFO_MULTIPLIER : DAY_LFO_MULTIPLIER;
  return baseLfoRate * multiplier;
};

const computeMoonDepthFactor = (moonPhase: number): number => {
  const normalizedPhase = clamp(moonPhase, MIN_MOON_PHASE, MAX_MOON_PHASE);
  // 0/1 (new moon) => 0, 0.5 (full moon) => 1 with a smooth sinusoidal curve.
  return Math.sin(normalizedPhase * Math.PI);
};

const computeLfoDepth = (moonPhase: number): number => {
  const depthFactor = computeMoonDepthFactor(moonPhase);
  return MIN_LFO_DEPTH + (MAX_LFO_DEPTH - MIN_LFO_DEPTH) * depthFactor;
};

const computeUiState = (nightMode: boolean): ResonanceUiState => {
  if (nightMode) {
    return {
      animationSpeed: NIGHT_ANIMATION_SPEED,
      interactionLatency: NIGHT_INTERACTION_LATENCY_MS,
      theme: "night-muted",
    };
  }

  return {
    animationSpeed: DAY_ANIMATION_SPEED,
    interactionLatency: DAY_INTERACTION_LATENCY_MS,
    theme: "day-bright",
  };
};

export const computeResonanceState = ({
  sunAltitude,
  moonPhase,
  baseLfoRate,
}: ResonanceInput): ResonanceState => {
  const nightMode = isNightMode(sunAltitude);

  return {
    lfoRate: computeLfoRate(baseLfoRate, nightMode),
    lfoDepth: computeLfoDepth(moonPhase),
    ui: computeUiState(nightMode),
  };
};

export const reflect = async (input: string, endpoint = "/reflect"): Promise<ReflectResponse> => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    throw new Error(`Reflect request failed: ${response.status}`);
  }

  return (await response.json()) as ReflectResponse;
};
