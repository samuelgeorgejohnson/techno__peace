import type { HourlySignal, Ring } from "@technopeace/codex-data/src/types";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const sunArcHeight = (signal: HourlySignal): number => {
  const normalized = signal.sunAltitudeDeg / 90;
  return clamp(normalized, -1, 1);
};

export const ringsFromSignal = (signal: HourlySignal): Ring[] => {
  const windIntensity = clamp(signal.windMps / 20, 0, 1);
  const cloudFade = 1 - clamp(signal.cloudCover, 0, 1);
  const moonGlow = clamp(signal.moonPhase, 0, 1);

  return [
    {
      id: "atmosphere",
      radius: 120,
      thickness: 12,
      intensity: 0.4 + windIntensity * 0.4,
      color: `rgba(135, 206, 250, ${0.3 + cloudFade * 0.5})`,
    },
    {
      id: "wind",
      radius: 160,
      thickness: 18,
      intensity: 0.3 + windIntensity * 0.5,
      color: `rgba(255, 255, 255, ${0.2 + windIntensity * 0.5})`,
    },
    {
      id: "lunar",
      radius: 200,
      thickness: 20,
      intensity: 0.2 + moonGlow * 0.6,
      color: `rgba(180, 180, 255, ${0.25 + moonGlow * 0.5})`,
    },
  ];
};
