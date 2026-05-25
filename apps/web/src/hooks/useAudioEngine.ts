import { useEffect, useRef, useState } from "react";
import type { AudioEngineSignalPayload, ChaosLaneId } from "@technopeace/codex-data/types/SignalPayload";

function clamp(x: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

function fractional(x: number) {
  return x - Math.floor(x);
}

export function derivePlaceBaseFrequency(latitude: number, longitude: number) {
  const lat = clamp((latitude + 90) / 180);
  const lon = clamp((longitude + 180) / 360);
  const seedA = fractional(Math.sin((latitude + 90) * 12.9898 + (longitude + 180) * 78.233) * 43758.5453);
  const seedB = fractional(Math.sin((latitude + 90) * 39.3467 + (longitude + 180) * 11.1351) * 19642.349);

  const modeSteps = [0, 2, 3, 5, 7, 8, 10];
  const degree = modeSteps[Math.floor(seedA * modeSteps.length)];
  const octave = 2 + Math.floor((0.58 * lat + 0.42 * lon) * 3);
  const baseMidi = 36 + octave * 12 + degree;
  const microDetuneCents = (seedB - 0.5) * 14;

  return 440 * Math.pow(2, (baseMidi - 69) / 12) * Math.pow(2, microDetuneCents / 1200);
}

export type AudioMonitorState = {
  baseDrone: boolean;
  wind: boolean;
  rain: boolean;
  birds: boolean;
  chimes: boolean;
  air: boolean;
  traffic: boolean;
};

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);

  const subRef = useRef<OscillatorNode | null>(null);
  const infraRootRef = useRef<OscillatorNode | null>(null);
  const infraOctaveRef = useRef<OscillatorNode | null>(null);
  const infraSubOctaveRef = useRef<OscillatorNode | null>(null);
  const rootRef = useRef<OscillatorNode | null>(null);
  const fifthRef = useRef<OscillatorNode | null>(null);
  const octaveRef = useRef<OscillatorNode | null>(null);
  const noiseSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const airNoiseSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const airToneRef = useRef<OscillatorNode | null>(null);

  const masterGainRef = useRef<GainNode | null>(null);
  const baseDroneGainRef = useRef<GainNode | null>(null);
  const mainSignalGainRef = useRef<GainNode | null>(null);
  const mainSignalWetGainRef = useRef<GainNode | null>(null);
  const mainSignalDryGainRef = useRef<GainNode | null>(null);
  const weatherGainRef = useRef<GainNode | null>(null);
  const windGainRef = useRef<GainNode | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);
  const celestialGainRef = useRef<GainNode | null>(null);
  const lifeGainRef = useRef<GainNode | null>(null);
  const airGainRef = useRef<GainNode | null>(null);
  const trafficGainRef = useRef<GainNode | null>(null);
  const chaosGainRef = useRef<GainNode | null>(null);
  const chaosKickGainRef = useRef<GainNode | null>(null);
  const chaosHatGainRef = useRef<GainNode | null>(null);

  const baseFilterRef = useRef<BiquadFilterNode | null>(null);
  const infraFilterRef = useRef<BiquadFilterNode | null>(null);
  const infraSaturationRef = useRef<WaveShaperNode | null>(null);
  const weatherFilterRef = useRef<BiquadFilterNode | null>(null);
  const mainSignalPostFilterRef = useRef<BiquadFilterNode | null>(null);
  const mainSignalSaturationRef = useRef<WaveShaperNode | null>(null);
  const mainSignalShimmerDelayRef = useRef<DelayNode | null>(null);
  const mainSignalShimmerGainRef = useRef<GainNode | null>(null);
  const mainSignalReverbFilterRef = useRef<BiquadFilterNode | null>(null);
  const mainSignalReverbGainRef = useRef<GainNode | null>(null);
  const mainSignalRainNoiseGainRef = useRef<GainNode | null>(null);
  const mainSignalCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  const mainSignalGateRef = useRef<GainNode | null>(null);
  const mainSignalStereoRef = useRef<StereoPannerNode | null>(null);
  const weatherNoiseGainRef = useRef<GainNode | null>(null);
  const airNoiseFilterRef = useRef<BiquadFilterNode | null>(null);
  const airNoiseGainRef = useRef<GainNode | null>(null);
  const airToneFilterRef = useRef<BiquadFilterNode | null>(null);
  const airToneGainRef = useRef<GainNode | null>(null);
  const airPannerRef = useRef<StereoPannerNode | null>(null);
  const daylifeFilterRef = useRef<BiquadFilterNode | null>(null);
  const daylifeGainRef = useRef<GainNode | null>(null);
  const chimeFilterRef = useRef<BiquadFilterNode | null>(null);
  const chimeGainRef = useRef<GainNode | null>(null);
  const trafficFilterRef = useRef<BiquadFilterNode | null>(null);
  const chaosBassFilterRef = useRef<BiquadFilterNode | null>(null);
  const chaosHatFilterRef = useRef<BiquadFilterNode | null>(null);
  const chaosNoiseGainRef = useRef<GainNode | null>(null);
  const chaosDuckGainRef = useRef<GainNode | null>(null);

  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const airMotionLfoRef = useRef<OscillatorNode | null>(null);
  const airMotionGainRef = useRef<GainNode | null>(null);

  const daylifeActivityRef = useRef(0);
  const nextDaylifeEventRef = useRef(0);
  const chimeActivityRef = useRef(0);
  const nextChimeEventRef = useRef(0);
  const airPanDriftRef = useRef(0);
  const nextAirPassEventRef = useRef(0);
  const nextTrafficEventRef = useRef(0);
  const nextChaosPulseRef = useRef(0);
  const chaosStepRef = useRef(0);
  const chaosStepsRef = useRef(16);

  const startedRef = useRef(false);
  const stopTimeoutRef = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const monitorStateRef = useRef<AudioMonitorState>({
    baseDrone: true,
    wind: true,
    rain: true,
    birds: true,
    chimes: true,
    air: true,
    traffic: true,
  });

  function resetGraph() {
    subRef.current = null;
    infraRootRef.current = null;
    infraOctaveRef.current = null;
    infraSubOctaveRef.current = null;
    rootRef.current = null;
    fifthRef.current = null;
    octaveRef.current = null;
    noiseSrcRef.current = null;
    airNoiseSrcRef.current = null;
    airToneRef.current = null;

    masterGainRef.current = null;
    baseDroneGainRef.current = null;
    mainSignalGainRef.current = null;
    mainSignalWetGainRef.current = null;
    mainSignalDryGainRef.current = null;
    weatherGainRef.current = null;
    windGainRef.current = null;
    rainGainRef.current = null;
    celestialGainRef.current = null;
    lifeGainRef.current = null;
    airGainRef.current = null;
    trafficGainRef.current = null;
    chaosGainRef.current = null;
    chaosKickGainRef.current = null;
    chaosHatGainRef.current = null;

    baseFilterRef.current = null;
    infraFilterRef.current = null;
    infraSaturationRef.current = null;
    weatherFilterRef.current = null;
    mainSignalPostFilterRef.current = null;
    mainSignalSaturationRef.current = null;
    mainSignalShimmerDelayRef.current = null;
    mainSignalShimmerGainRef.current = null;
    mainSignalReverbFilterRef.current = null;
    mainSignalReverbGainRef.current = null;
    mainSignalRainNoiseGainRef.current = null;
    mainSignalCompressorRef.current = null;
    mainSignalGateRef.current = null;
    mainSignalStereoRef.current = null;
    weatherNoiseGainRef.current = null;
    airNoiseFilterRef.current = null;
    airNoiseGainRef.current = null;
    airToneFilterRef.current = null;
    airToneGainRef.current = null;
    airPannerRef.current = null;
    daylifeFilterRef.current = null;
    daylifeGainRef.current = null;
    chimeFilterRef.current = null;
    chimeGainRef.current = null;
    trafficFilterRef.current = null;
    chaosBassFilterRef.current = null;
    chaosHatFilterRef.current = null;
    chaosNoiseGainRef.current = null;
    chaosDuckGainRef.current = null;

    lfoRef.current = null;
    lfoGainRef.current = null;
    airMotionLfoRef.current = null;
    airMotionGainRef.current = null;

    daylifeActivityRef.current = 0;
    nextDaylifeEventRef.current = 0;
    chimeActivityRef.current = 0;
    nextChimeEventRef.current = 0;
    airPanDriftRef.current = 0;
    nextAirPassEventRef.current = 0;
    nextTrafficEventRef.current = 0;
    nextChaosPulseRef.current = 0;
    chaosStepRef.current = 0;
    chaosStepsRef.current = 16;
    startedRef.current = false;
  }

  function ensureContext(): AudioContext {
    if (ctxRef.current && ctxRef.current.state !== "closed") return ctxRef.current;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    resetGraph();
    return ctx;
  }

  async function start() {
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    if (startedRef.current) {
      const ctx = ensureContext();
      if (ctx.state !== "running") await ctx.resume();
      setIsRunning(ctx.state === "running");
      return;
    }

    const ctx = ensureContext();
    if (ctx.state !== "running") await ctx.resume();

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;
    masterGainRef.current = masterGain;

    const baseDroneGain = ctx.createGain();
    baseDroneGain.gain.value = 0;
    baseDroneGainRef.current = baseDroneGain;
    const weatherGain = ctx.createGain();
    weatherGain.gain.value = 0;
    weatherGainRef.current = weatherGain;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windGainRef.current = windGain;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainGainRef.current = rainGain;
    const celestialGain = ctx.createGain();
    celestialGain.gain.value = 0;
    celestialGainRef.current = celestialGain;
    const lifeGain = ctx.createGain();
    lifeGain.gain.value = 0;
    lifeGainRef.current = lifeGain;
    const airGain = ctx.createGain();
    airGain.gain.value = 0;
    airGainRef.current = airGain;
    const trafficGain = ctx.createGain();
    trafficGain.gain.value = 0;
    trafficGainRef.current = trafficGain;
    const chaosGain = ctx.createGain();
    chaosGain.gain.value = 0;
    chaosGainRef.current = chaosGain;
    const chaosKickGain = ctx.createGain();
    chaosKickGain.gain.value = 0;
    chaosKickGainRef.current = chaosKickGain;
    const chaosHatGain = ctx.createGain();
    chaosHatGain.gain.value = 0;
    chaosHatGainRef.current = chaosHatGain;
    const mainSignalGain = ctx.createGain();
    mainSignalGain.gain.value = 1;
    mainSignalGainRef.current = mainSignalGain;
    const mainSignalDryGain = ctx.createGain();
    mainSignalDryGain.gain.value = 1;
    mainSignalDryGainRef.current = mainSignalDryGain;
    const mainSignalWetGain = ctx.createGain();
    mainSignalWetGain.gain.value = 0;
    mainSignalWetGainRef.current = mainSignalWetGain;

    const baseFilter = ctx.createBiquadFilter();
    baseFilter.type = "lowpass";
    baseFilter.frequency.value = 1200;
    baseFilter.Q.value = 0.6;
    baseFilterRef.current = baseFilter;

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 55;
    subRef.current = sub;
    const root = ctx.createOscillator();
    root.type = "triangle";
    root.frequency.value = 110;
    rootRef.current = root;
    const fifth = ctx.createOscillator();
    fifth.type = "sine";
    fifth.frequency.value = 165;
    fifthRef.current = fifth;
    const octave = ctx.createOscillator();
    octave.type = "triangle";
    octave.frequency.value = 220;
    octaveRef.current = octave;
    const infraRoot = ctx.createOscillator();
    infraRoot.type = "sine";
    infraRoot.frequency.value = 110;
    infraRootRef.current = infraRoot;
    const infraOctave = ctx.createOscillator();
    infraOctave.type = "triangle";
    infraOctave.frequency.value = 55;
    infraOctaveRef.current = infraOctave;
    const infraSubOctave = ctx.createOscillator();
    infraSubOctave.type = "sine";
    infraSubOctave.frequency.value = 27.5;
    infraSubOctaveRef.current = infraSubOctave;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.25;
    const rootGain = ctx.createGain();
    rootGain.gain.value = 0.45;
    const fifthGain = ctx.createGain();
    fifthGain.gain.value = 0.18;
    const octaveGain = ctx.createGain();
    octaveGain.gain.value = 0.08;
    const infraRootGain = ctx.createGain();
    infraRootGain.gain.value = 0.085;
    const infraOctaveGain = ctx.createGain();
    infraOctaveGain.gain.value = 0.07;
    const infraSubOctaveGain = ctx.createGain();
    infraSubOctaveGain.gain.value = 0.03;

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;
    noiseSrc.loop = true;
    noiseSrcRef.current = noiseSrc;

    const airNoiseSrc = ctx.createBufferSource();
    airNoiseSrc.buffer = buffer;
    airNoiseSrc.loop = true;
    airNoiseSrcRef.current = airNoiseSrc;

    const weatherFilter = ctx.createBiquadFilter();
    weatherFilter.type = "highpass";
    weatherFilter.frequency.value = 320;
    weatherFilter.Q.value = 0.6;
    weatherFilterRef.current = weatherFilter;
    const mainSignalPostFilter = ctx.createBiquadFilter();
    mainSignalPostFilter.type = "lowpass";
    mainSignalPostFilter.frequency.value = 1400;
    mainSignalPostFilter.Q.value = 0.8;
    mainSignalPostFilterRef.current = mainSignalPostFilter;
    const infraFilter = ctx.createBiquadFilter();
    infraFilter.type = "lowpass";
    infraFilter.frequency.value = 170;
    infraFilter.Q.value = 0.82;
    infraFilterRef.current = infraFilter;
    const infraSaturation = ctx.createWaveShaper();
    infraSaturation.curve = new Float32Array([-1, -0.94, -0.44, 0, 0.44, 0.94, 1]);
    infraSaturation.oversample = "2x";
    infraSaturationRef.current = infraSaturation;
    const mainSignalSaturation = ctx.createWaveShaper();
    mainSignalSaturation.curve = new Float32Array([-1, -0.85, -0.3, 0, 0.3, 0.85, 1]);
    mainSignalSaturation.oversample = "2x";
    mainSignalSaturationRef.current = mainSignalSaturation;
    const mainSignalShimmerDelay = ctx.createDelay(1.2);
    mainSignalShimmerDelay.delayTime.value = 0.22;
    mainSignalShimmerDelayRef.current = mainSignalShimmerDelay;
    const mainSignalShimmerGain = ctx.createGain();
    mainSignalShimmerGain.gain.value = 0;
    mainSignalShimmerGainRef.current = mainSignalShimmerGain;
    const mainSignalReverbFilter = ctx.createBiquadFilter();
    mainSignalReverbFilter.type = "highpass";
    mainSignalReverbFilter.frequency.value = 1200;
    mainSignalReverbGainRef.current = ctx.createGain();
    mainSignalReverbGainRef.current.gain.value = 0;
    mainSignalReverbFilterRef.current = mainSignalReverbFilter;
    const mainSignalRainNoiseGain = ctx.createGain();
    mainSignalRainNoiseGain.gain.value = 0;
    mainSignalRainNoiseGainRef.current = mainSignalRainNoiseGain;
    const mainSignalCompressor = ctx.createDynamicsCompressor();
    mainSignalCompressor.threshold.value = -24;
    mainSignalCompressor.knee.value = 14;
    mainSignalCompressor.ratio.value = 2.2;
    mainSignalC