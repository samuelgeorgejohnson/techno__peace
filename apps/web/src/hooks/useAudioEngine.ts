import { useEffect, useState } from "react";
import { audioEngine, type ChaosParams, type MixerParams } from "../audio/audioEngine";

export type AudioParams = ChaosParams;

export function useAudioEngine() {
  const [isRunning, setIsRunning] = useState(audioEngine.isRunning());

  useEffect(() => audioEngine.subscribe(setIsRunning), []);

  return {
    start: () => audioEngine.start(),
    update: (params: ChaosParams) => audioEngine.updateChaos(params),
    updateMixer: (params: Partial<MixerParams>) => audioEngine.updateMixer(params),
    getMixer: () => audioEngine.getMixerParams(),
    stop: () => audioEngine.suspend(),
    isRunning,
  };
}
