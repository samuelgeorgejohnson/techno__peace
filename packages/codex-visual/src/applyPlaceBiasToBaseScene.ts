import type { PlaceSceneBias } from "@technopeace/codex-data/src/placeBias";

export interface BaseScene {
  audio: {
    droneLevel: number;
    noiseLevel: number;
    brightness: number;
    modRate: number;
    modDepth: number;
    stereoWidth: number;
    centerGain: number;
    pulseAmount: number;
  };
  visual: {
    motion: number;
    jitter: number;
    contrast: number;
    brightness: number;
    colorShift: number;
    centerStability: number;
    particleDensity: number;
  };
  ui: {
    chaosRange: number;
    mixerSensitivity: number;
    gestureSmoothing: number;
  };
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function applyPlaceBiasToBaseScene(baseScene: BaseScene, bias: PlaceSceneBias): BaseScene {
  return {
    audio: {
      ...baseScene.audio,
      noiseLevel: clamp(baseScene.audio.noiseLevel * (0.7 + bias.audio.noiseBias * 0.6)),
      brightness: clamp(baseScene.audio.brightness * (0.75 + bias.audio.brightnessBias * 0.5)),
      stereoWidth: clamp(baseScene.audio.stereoWidth * (0.75 + bias.audio.stereoWidthBias * 0.5)),
      pulseAmount: clamp(baseScene.audio.pulseAmount * (0.7 + bias.audio.pulseBias * 0.6)),
      droneLevel: clamp(baseScene.audio.droneLevel * (0.75 + bias.audio.droneBias * 0.5)),
      centerGain: clamp(baseScene.audio.centerGain * (0.75 + bias.audio.centerHoldBias * 0.5)),
    },
    visual: {
      ...baseScene.visual,
      motion: clamp(baseScene.visual.motion * (0.75 + bias.visual.motionBias * 0.5)),
      contrast: clamp(baseScene.visual.contrast * (0.75 + bias.visual.contrastBias * 0.5)),
      brightness: clamp(baseScene.visual.brightness * (0.75 + bias.visual.brightnessBias * 0.5)),
      centerStability: clamp(
        baseScene.visual.centerStability * (0.75 + bias.visual.centerStabilityBias * 0.5)
      ),
      particleDensity: clamp(
        baseScene.visual.particleDensity * (0.75 + bias.visual.particleBias * 0.5)
      ),
    },
    ui: {
      ...baseScene.ui,
      chaosRange: clamp(baseScene.ui.chaosRange * (0.75 + bias.ui.chaosBias * 0.5)),
      gestureSmoothing: clamp(
        baseScene.ui.gestureSmoothing * (0.75 + bias.ui.smoothingBias * 0.5)
      ),
      mixerSensitivity: clamp(baseScene.ui.mixerSensitivity * (0.8 + bias.ui.focusBias * 0.35)),
    },
  };
}
