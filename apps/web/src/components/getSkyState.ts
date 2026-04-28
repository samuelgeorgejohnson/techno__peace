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
  moonIllumination = 0,
}: {
  sunAltitudeDeg: number;
  cloudCover: number;
  windMps: number;
  isDay: boolean;
  moonIllumination?: number;
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
  const clearSkyFactor = 1 - cloud;
  const moonLightFactor = clamp01(moonIllumination);
  const nightEligible = sun < -0.833;
  const baseBrightness = clamp01(0.05 + 0.5 * dayness + 0.33 * noonLift - 0.18 * duskDrop);
  const twilightBoost =
    phase === "sunrise-sunset"
      ? 0.1
      : phase === "civil-twilight"
        ? 0.09
        : phase === "nautical-twilight"
          ? 0.08
          : phase === "astronomical-twilight"
            ? 0.065
            : phase === "night"
              ? 0.05
              : 0;
  const moonLift = nightEligible ? 0.02 + moonLightFactor * clearSkyFactor * 0.13 : 0;
  const cloudNightPenalty = nightEligible ? cloud * 0.025 : 0;
  const brightness = clamp01(baseBrightness + twilightBoost + moonLift - cloudNightPenalty);

  const horizonWarmth = 1 - smoothstep(2, 18, Math.abs(sun));
  const goldenWarmth = smoothstep(4, 16, sun) * (1 - smoothstep(16, 26, sun));
  const dayBlue = smoothstep(8, 45, sun);

  const nightTop: [number, number, number] = [8, 16, 38];
  const dawnTop: [number, number, number] = [56, 70, 104];
  const dayTop: [number, number, number] = [74, 139, 226];

  const nightMid: [number, number, number] = [14, 24, 52];
  const dawnMid: [number, number, number] = [168, 136, 92];
  const dayMid: [number, number, number] = [126, 182, 244];

  const nightHorizon: [number, number, number] = [20, 30, 58];
  const dawnHorizon: [number, number, number] = [246, 196, 122];
  const dayHorizon: [number, number, number] = [186, 214, 252];

  const moonTint: [number, number, number] = [128, 148, 188];
  const moonTintStrength = nightEligible ? 0.06 + moonLightFactor * clearSkyFactor * 0.2 : 0;

  const topBase = blendRgb(
    blendRgb(blendRgb(nightTop, dawnTop, dayness), dayTop, dayBlue),
    moonTint,
    moonTintStrength * 0.9,
  );
  const midBase = blendRgb(
    blendRgb(blendRgb(nightMid, dawnMid, dayness), dayMid, dayBlue),
    moonTint,
    moonTintStrength,
  );
  const horizonBase = blendRgb(
    blendRgb(
      blendRgb(nightHorizon, dawnHorizon, Math.max(horizonWarmth * 0.72 + goldenWarmth * 0.2, dayness * 0.5)),
      dayHorizon,
      dayBlue * 0.85,
    ),
    moonTint,
    moonTintStrength * 0.72,
  );

  const goldenTint: [number, number, number] = [255, 196, 112];
  const goldenTintStrength = clamp01(horizonWarmth * 0.42 + goldenWarmth * 0.58) * (1 - dayBlue * 0.45);

  const overcastTint = blendRgb([44, 52, 76], [132, 145, 166], dayness);
  const cloudMute = smoothstep(0.35, 1, cloud) * (0.4 + 0.24 * dayness);

  const topColor = toRgbString(blendRgb(blendRgb(topBase, goldenTint, goldenTintStrength * 0.22), overcastTint, cloudMute));
  const midColor = toRgbString(blendRgb(blendRgb(midBase, goldenTint, goldenTintStrength * 0.36), overcastTint, cloudMute * 0.85));
  const horizonColor = toRgbString(blendRgb(blendRgb(horizonBase, goldenTint, goldenTintStrength * 0.64), overcastTint, cloudMute * 0.65));

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
