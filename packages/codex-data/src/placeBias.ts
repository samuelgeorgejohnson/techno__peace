export interface PlaceSceneBias {
  audio: {
    textureBias: number;
    brightnessBias: number;
    warmthBias: number;
    stereoWidthBias: number;
    reverbBias: number;
    pulseBias: number;
    noiseBias: number;
    droneBias: number;
    centerHoldBias: number;
  };
  visual: {
    contrastBias: number;
    motionBias: number;
    brightnessBias: number;
    colorTempBias: number;
    particleBias: number;
    horizonOpenBias: number;
    centerStabilityBias: number;
  };
  ui: {
    chaosBias: number;
    smoothingBias: number;
    focusBias: number;
  };
}
