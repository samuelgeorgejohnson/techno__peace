import type { PlaceSceneBias } from "@technopeace/codex-data/src/placeBias";
import type { PlaceProfile } from "@technopeace/codex-data/src/placeProfile";

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function windSafeVegetationReduction(vegetation: number): number {
  return -vegetation * 0.08;
}

export function mapPlaceProfileToSceneBias(profile: PlaceProfile): PlaceSceneBias {
  const {
    density,
    hardness,
    openness,
    waterPresence,
    humanActivity,
    mechanicalActivity,
    vegetation,
    reflectivity,
    spectacle,
    containment,
  } = profile;

  const textureBias = clamp(
    density * 0.3 +
      humanActivity * 0.25 +
      mechanicalActivity * 0.3 +
      reflectivity * 0.15
  );

  const brightnessBias = clamp(
    hardness * 0.35 +
      reflectivity * 0.35 +
      spectacle * 0.2 +
      mechanicalActivity * 0.1 -
      vegetation * 0.15
  );

  const warmthBias = clamp(
    vegetation * 0.3 +
      waterPresence * 0.15 +
      containment * 0.15 -
      hardness * 0.1 -
      reflectivity * 0.1 +
      0.35
  );

  const stereoWidthBias = clamp(
    openness * 0.45 +
      waterPresence * 0.25 +
      vegetation * 0.1 -
      containment * 0.15 -
      density * 0.1 +
      0.2
  );

  const reverbBias = clamp(
    openness * 0.3 +
      reflectivity * 0.3 +
      waterPresence * 0.15 +
      hardness * 0.1 -
      density * 0.1 +
      0.1
  );

  const pulseBias = clamp(
    humanActivity * 0.3 + mechanicalActivity * 0.35 + spectacle * 0.2 + density * 0.15
  );

  const noiseBias = clamp(
    mechanicalActivity * 0.35 +
      density * 0.25 +
      humanActivity * 0.2 +
      waterPresence * 0.1 +
      windSafeVegetationReduction(vegetation)
  );

  const droneBias = clamp(
    openness * 0.2 +
      waterPresence * 0.15 +
      vegetation * 0.25 +
      containment * 0.15 -
      spectacle * 0.05 +
      0.2
  );

  const centerHoldBias = clamp(
    containment * 0.45 +
      vegetation * 0.1 +
      density * 0.1 -
      openness * 0.15 +
      spectacle * 0.1 +
      0.2
  );

  const contrastBias = clamp(
    spectacle * 0.3 +
      reflectivity * 0.2 +
      hardness * 0.2 +
      density * 0.15 -
      vegetation * 0.1 +
      0.15
  );

  const motionBias = clamp(
    humanActivity * 0.25 +
      mechanicalActivity * 0.25 +
      openness * 0.15 +
      waterPresence * 0.1 +
      spectacle * 0.25
  );

  const visualBrightnessBias = clamp(
    reflectivity * 0.25 +
      spectacle * 0.2 +
      openness * 0.15 -
      containment * 0.1 -
      vegetation * 0.05 +
      0.25
  );

  const colorTempBias = clamp(
    hardness * 0.2 +
      reflectivity * 0.2 +
      mechanicalActivity * 0.15 +
      waterPresence * 0.05 -
      vegetation * 0.1 +
      0.35
  );

  const particleBias = clamp(
    density * 0.2 +
      humanActivity * 0.2 +
      mechanicalActivity * 0.2 +
      waterPresence * 0.1 +
      spectacle * 0.15 +
      openness * 0.15
  );

  const horizonOpenBias = clamp(
    openness * 0.6 + waterPresence * 0.2 - containment * 0.15 - density * 0.05
  );

  const centerStabilityBias = clamp(
    containment * 0.5 + density * 0.1 + vegetation * 0.1 - spectacle * 0.1 + 0.2
  );

  const chaosBias = clamp(
    spectacle * 0.35 +
      density * 0.2 +
      humanActivity * 0.2 +
      mechanicalActivity * 0.2 -
      containment * 0.15
  );

  const smoothingBias = clamp(
    containment * 0.4 + vegetation * 0.15 + waterPresence * 0.05 - spectacle * 0.1 + 0.25
  );

  const focusBias = clamp(
    containment * 0.3 +
      spectacle * 0.15 +
      reflectivity * 0.1 +
      hardness * 0.1 -
      openness * 0.1 +
      0.25
  );

  return {
    audio: {
      textureBias: round(textureBias),
      brightnessBias: round(brightnessBias),
      warmthBias: round(warmthBias),
      stereoWidthBias: round(stereoWidthBias),
      reverbBias: round(reverbBias),
      pulseBias: round(pulseBias),
      noiseBias: round(noiseBias),
      droneBias: round(droneBias),
      centerHoldBias: round(centerHoldBias),
    },
    visual: {
      contrastBias: round(contrastBias),
      motionBias: round(motionBias),
      brightnessBias: round(visualBrightnessBias),
      colorTempBias: round(colorTempBias),
      particleBias: round(particleBias),
      horizonOpenBias: round(horizonOpenBias),
      centerStabilityBias: round(centerStabilityBias),
    },
    ui: {
      chaosBias: round(chaosBias),
      smoothingBias: round(smoothingBias),
      focusBias: round(focusBias),
    },
  };
}
