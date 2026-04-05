export type SkyPhase =
  | "night"
  | "astronomical-twilight"
  | "nautical-twilight"
  | "civil-twilight"
  | "sunrise-sunset"
  | "golden-hour"
  | "full-day";

export type SkyState = {
  topColor: string;
  midColor: string;
  horizonColor: string;
  brightness: number;
  cloudOpacity: number;
  cloudSpeed: number;
  phase: SkyPhase;
  horizonWarmth: number;
  goldenWarmth: number;
  dayBlue: number;
  cloudDensity: "low" | "medium" | "high";
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function toRgbString([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

function blendRgb(a: [number, number, number], b: [number, number, number], t: number) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)] as [number, number, number];
}

export function getSkyState({
  sunAltitudeDeg,
  cloudCover,
  windMps,
}: {
  sunAltitudeDeg: number;
  cloudCover: number;
  windMps: number;
}): SkyState {
  const sun = Math.max(-90, Math.min(90, sunAltitudeDeg));
  const cloud = clamp01(cloudCover);
  const wind = Math.max(0, windMps);

  let phase: SkyPhase = "night";
  if (sun >= -18 && sun < -12) phase = "astronomical-twilight";
  else if (sun >= -12 && sun < -6) phase = "nautical-twilight";
  else if (sun >= -6 && sun < -0.833) phase = "civil-twilight";
  else if (sun >= -0.833 && sun < 6) phase = "sunrise-sunset";
  else if (sun >= 6 && sun < 18) phase = "golden-hour";
  else if (sun >= 18) phase = "full-day";

  const isNight = sun < -6;
  const dayLift = smoothstep(-10, 20, sun);
  const dayBlue = smoothstep(8, 45, sun);

  const horizonWarmthBase = Math.max(smoothstep(-8, 4, sun), smoothstep(4, -8, sun));
  const goldenWarmthBase = smoothstep(4, 16, sun) * (1 - smoothstep(16, 26, sun));

  const overcast = smoothstep(0.45, 1, cloud);

  const nightTop: [number, number, number] = [7, 11, 20];
  const nightMid: [number, number, number] = [14, 20, 32];
  const nightHorizon: [number, number, number] = [20, 24, 34];

  const dawnTop: [number, number, number] = [42, 58, 92];
  const dawnMid: [number, number, number] = [84, 101, 138];
  const dawnHorizon: [number, number, number] = [186, 138, 118];

  const dayTop: [number, number, number] = [116, 168, 224];
  const dayMid: [number, number, number] = [170, 202, 235];
  const dayHorizon: [number, number, number] = [214, 228, 243];

  let topBase = blendRgb(blendRgb(nightTop, dawnTop, dayLift), dayTop, dayBlue);
  let midBase = blendRgb(blendRgb(nightMid, dawnMid, dayLift), dayMid, dayBlue);
  let horizonBase = blendRgb(blendRgb(nightHorizon, dawnHorizon, horizonWarmthBase), dayHorizon, dayBlue);

  if (isNight) {
    const nightDepth = smoothstep(-6, -30, sun);
    topBase = blendRgb(topBase, nightTop, 0.65 + 0.35 * nightDepth);
    midBase = blendRgb(midBase, nightMid, 0.65 + 0.35 * nightDepth);
    horizonBase = blendRgb(horizonBase, nightHorizon, 0.7 + 0.3 * nightDepth);
  }

  const overcastTop: [number, number, number] = isNight ? [20, 24, 32] : [128, 138, 148];
  const overcastMid: [number, number, number] = isNight ? [26, 30, 38] : [144, 152, 160];
  const overcastHorizon: [number, number, number] = isNight ? [30, 34, 40] : [158, 162, 166];

  topBase = blendRgb(topBase, overcastTop, overcast * 0.78);
  midBase = blendRgb(midBase, overcastMid, overcast * 0.72);
  horizonBase = blendRgb(horizonBase, overcastHorizon, overcast * 0.64);

  const horizonWarmth = horizonWarmthBase * (1 - overcast * 0.9);
  const goldenWarmth = goldenWarmthBase * (1 - overcast * 0.95);

  const brightnessBase = isNight
    ? 0.08 + smoothstep(-18, -6, sun) * 0.08
    : 0.3 + 0.55 * dayLift;

  const brightness = clamp01(brightnessBase * (1 - cloud * 0.38));

  const topColor = toRgbString(topBase);
  const midColor = toRgbString(midBase);
  const horizonColor = toRgbString(horizonBase);

  const cloudDensity = cloud < 0.28 ? "low" : cloud < 0.7 ? "medium" : "high";
  const cloudOpacity =
    cloudDensity === "low"
      ? 0.08 + cloud * 0.15
      : cloudDensity === "medium"
        ? 0.18 + cloud * 0.24
        : 0.42 + cloud * 0.26;

  const cloudSpeed = 10 + wind * 5.5;

  return {
    topColor,
    midColor,
    horizonColor,
    brightness,
    cloudOpacity: clamp01(cloudOpacity),
    cloudSpeed,
    phase,
    horizonWarmth,
    goldenWarmth,
    dayBlue,
    cloudDensity,
  };
}
