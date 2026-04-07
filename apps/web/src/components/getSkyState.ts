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
  dayness: number;
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
  isDay,
}: {
  sunAltitudeDeg: number;
  cloudCover: number;
  windMps: number;
  isDay: boolean;
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

  const dayLift = smoothstep(-10, 20, sun);
  const noonLift = smoothstep(10, 55, sun);
  const dayness = clamp01((isDay ? 0.72 : 0) + (0.28 * dayLift + 0.22 * noonLift));
  const duskDrop = smoothstep(4, -12, sun);
  const brightness = clamp01(0.05 + 0.5 * dayness + 0.33 * noonLift - 0.18 * duskDrop);

  const horizonWarmth = 1 - smoothstep(2, 18, Math.abs(sun));
  const goldenWarmth = smoothstep(4, 16, sun) * (1 - smoothstep(16, 26, sun));
  const dayBlue = smoothstep(8, 45, sun);

  const nightTop: [number, number, number] = [4, 8, 20];
  const dawnTop: [number, number, number] = [34, 53, 92];
  const dayTop: [number, number, number] = [74, 139, 226];

  const nightMid: [number, number, number] = [10, 15, 31];
  const dawnMid: [number, number, number] = [77, 105, 162];
  const dayMid: [number, number, number] = [126, 182, 244];

  const nightHorizon: [number, number, number] = [18, 21, 36];
  const dawnHorizon: [number, number, number] = [222, 144, 112];
  const dayHorizon: [number, number, number] = [186, 214, 252];

  const topBase = blendRgb(blendRgb(nightTop, dawnTop, dayness), dayTop, dayBlue);
  const midBase = blendRgb(blendRgb(nightMid, dawnMid, dayness), dayMid, dayBlue);
  const horizonBase = blendRgb(blendRgb(nightHorizon, dawnHorizon, Math.max(horizonWarmth * 0.6, dayness * 0.72)), dayHorizon, dayBlue);

  const overcastTint: [number, number, number] = [132, 145, 166];
  const cloudMute = smoothstep(0.35, 1, cloud) * (0.4 + 0.24 * dayness);

  const topColor = toRgbString(blendRgb(topBase, overcastTint, cloudMute));
  const midColor = toRgbString(blendRgb(midBase, overcastTint, cloudMute * 0.85));
  const horizonColor = toRgbString(blendRgb(horizonBase, overcastTint, cloudMute * 0.65));

  const cloudDensity = cloud < 0.34 ? "low" : cloud < 0.68 ? "medium" : "high";
  const cloudOpacity =
    (cloudDensity === "low" ? 0.12 + cloud * 0.18 : cloudDensity === "medium" ? 0.24 + cloud * 0.3 : 0.46 + cloud * 0.32) *
    (0.82 + 0.24 * dayness);

  const cloudSpeed = 8 + wind * 4.8;

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
    dayness,
    cloudDensity,
  };
}
