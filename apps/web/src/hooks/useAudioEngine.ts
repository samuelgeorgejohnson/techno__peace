import { useEffect, useRef, useState } from "react";
import type { AudioEngineSignalPayload } from "@technopeace/codex-data/types/SignalPayload";

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

    const subGain = ctx.createGain();
    subGain.gain.value = 0.25;
    const rootGain = ctx.createGain();
    rootGain.gain.value = 0.45;
    const fifthGain = ctx.createGain();
    fifthGain.gain.value = 0.18;
    const octaveGain = ctx.createGain();
    octaveGain.gain.value = 0.08;

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
    mainSignalCompressor.attack.value = 0.03;
    mainSignalCompressor.release.value = 0.28;
    mainSignalCompressorRef.current = mainSignalCompressor;
    const mainSignalGate = ctx.createGain();
    mainSignalGate.gain.value = 1;
    mainSignalGateRef.current = mainSignalGate;
    const mainSignalStereo = ctx.createStereoPanner();
    mainSignalStereo.pan.value = 0;
    mainSignalStereoRef.current = mainSignalStereo;

    const weatherNoiseGain = ctx.createGain();
    weatherNoiseGain.gain.value = 0;
    weatherNoiseGainRef.current = weatherNoiseGain;

    const airNoiseFilter = ctx.createBiquadFilter();
    airNoiseFilter.type = "bandpass";
    airNoiseFilter.frequency.value = 900;
    airNoiseFilter.Q.value = 4.2;
    airNoiseFilterRef.current = airNoiseFilter;

    const airNoiseGain = ctx.createGain();
    airNoiseGain.gain.value = 0;
    airNoiseGainRef.current = airNoiseGain;

    const airTone = ctx.createOscillator();
    airTone.type = "sawtooth";
    airTone.frequency.value = 260;
    airToneRef.current = airTone;

    const airToneFilter = ctx.createBiquadFilter();
    airToneFilter.type = "bandpass";
    airToneFilter.frequency.value = 620;
    airToneFilter.Q.value = 8;
    airToneFilterRef.current = airToneFilter;

    const airToneGain = ctx.createGain();
    airToneGain.gain.value = 0;
    airToneGainRef.current = airToneGain;

    const airPanner = ctx.createStereoPanner();
    airPanner.pan.value = 0;
    airPannerRef.current = airPanner;

    const daylifeFilter = ctx.createBiquadFilter();
    daylifeFilter.type = "bandpass";
    daylifeFilter.frequency.value = 3400;
    daylifeFilter.Q.value = 3.2;
    daylifeFilterRef.current = daylifeFilter;

    const daylifeGain = ctx.createGain();
    daylifeGain.gain.value = 0;
    daylifeGainRef.current = daylifeGain;

    const chimeFilter = ctx.createBiquadFilter();
    chimeFilter.type = "bandpass";
    chimeFilter.frequency.value = 1200;
    chimeFilter.Q.value = 5.2;
    chimeFilterRef.current = chimeFilter;

    const chimeGain = ctx.createGain();
    chimeGain.gain.value = 0;
    chimeGainRef.current = chimeGain;

    const trafficFilter = ctx.createBiquadFilter();
    trafficFilter.type = "lowpass";
    trafficFilter.frequency.value = 140;
    trafficFilter.Q.value = 0.7;
    trafficFilterRef.current = trafficFilter;
    const chaosBassFilter = ctx.createBiquadFilter();
    chaosBassFilter.type = "lowpass";
    chaosBassFilter.frequency.value = 220;
    chaosBassFilter.Q.value = 1.1;
    chaosBassFilterRef.current = chaosBassFilter;
    const chaosHatFilter = ctx.createBiquadFilter();
    chaosHatFilter.type = "highpass";
    chaosHatFilter.frequency.value = 3800;
    chaosHatFilter.Q.value = 0.7;
    chaosHatFilterRef.current = chaosHatFilter;
    const chaosNoiseGain = ctx.createGain();
    chaosNoiseGain.gain.value = 0;
    chaosNoiseGainRef.current = chaosNoiseGain;
    const chaosDuckGain = ctx.createGain();
    chaosDuckGain.gain.value = 1;
    chaosDuckGainRef.current = chaosDuckGain;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.2;
    lfoRef.current = lfo;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0;
    lfoGainRef.current = lfoGain;

    const airMotionLfo = ctx.createOscillator();
    airMotionLfo.type = "sine";
    airMotionLfo.frequency.value = 0.08;
    airMotionLfoRef.current = airMotionLfo;

    const airMotionGain = ctx.createGain();
    airMotionGain.gain.value = 0;
    airMotionGainRef.current = airMotionGain;

    sub.connect(subGain);
    root.connect(rootGain);
    fifth.connect(fifthGain);
    octave.connect(octaveGain);
    subGain.connect(baseFilter);
    rootGain.connect(baseFilter);
    fifthGain.connect(baseFilter);
    octaveGain.connect(baseFilter);
    baseFilter.connect(mainSignalGain);
    mainSignalGain.connect(mainSignalPostFilter);
    mainSignalPostFilter.connect(mainSignalSaturation);
    mainSignalSaturation.connect(mainSignalDryGain);
    mainSignalSaturation.connect(mainSignalShimmerDelay);
    mainSignalShimmerDelay.connect(mainSignalShimmerGain);
    mainSignalShimmerGain.connect(mainSignalWetGain);
    mainSignalSaturation.connect(mainSignalReverbFilter);
    mainSignalReverbFilter.connect(mainSignalReverbGainRef.current);
    mainSignalReverbGainRef.current.connect(mainSignalWetGain);
    noiseSrc.connect(mainSignalRainNoiseGain);
    mainSignalRainNoiseGain.connect(mainSignalWetGain);
    mainSignalDryGain.connect(mainSignalCompressor);
    mainSignalWetGain.connect(mainSignalCompressor);
    mainSignalCompressor.connect(mainSignalGate);
    mainSignalGate.connect(mainSignalStereo);
    mainSignalStereo.connect(baseDroneGain);

    noiseSrc.connect(weatherFilter);
    weatherFilter.connect(weatherNoiseGain);
    weatherNoiseGain.connect(windGain);
    weatherNoiseGain.connect(rainGain);
    windGain.connect(weatherGain);
    rainGain.connect(weatherGain);

    airNoiseSrc.connect(airNoiseFilter);
    airNoiseFilter.connect(airNoiseGain);
    airNoiseGain.connect(airPanner);
    airTone.connect(airToneFilter);
    airToneFilter.connect(airToneGain);
    airToneGain.connect(airPanner);
    airPanner.connect(airGain);

    daylifeFilter.connect(daylifeGain);
    daylifeGain.connect(lifeGain);
    chimeFilter.connect(chimeGain);
    chimeGain.connect(celestialGain);

    noiseSrc.connect(trafficFilter);
    trafficFilter.connect(trafficGain);
    noiseSrc.connect(chaosHatFilter);
    chaosHatFilter.connect(chaosNoiseGain);
    chaosNoiseGain.connect(chaosHatGain);

    baseDroneGain.connect(masterGain);
    weatherGain.connect(masterGain);
    celestialGain.connect(masterGain);
    lifeGain.connect(masterGain);
    airGain.connect(masterGain);
    trafficGain.connect(masterGain);
    chaosKickGain.connect(chaosBassFilter);
    chaosBassFilter.connect(chaosGain);
    chaosHatGain.connect(chaosGain);
    chaosGain.connect(chaosDuckGain);
    chaosDuckGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);
    airMotionLfo.connect(airMotionGain);
    airMotionGain.connect(airToneFilter.frequency);

    sub.start();
    root.start();
    fifth.start();
    octave.start();
    noiseSrc.start();
    airNoiseSrc.start();
    airTone.start();
    lfo.start();
    airMotionLfo.start();

    startedRef.current = true;
    setIsRunning(ctx.state === "running");
  }

  function update(p: AudioEngineSignalPayload) {
    const ctx = ctxRef.current;
    if (!ctx || !startedRef.current) return;

    const x = clamp(p.x);
    const y = clamp(p.y);
    const pressure = clamp(p.pressure);
    const windNorm = clamp(p.windMps / 20);
    const humidityNorm = clamp(p.humidityPct / 100);
    const rainNorm = clamp((p.rainMm + p.showersMm) / 5);
    const precipNorm = clamp((p.rainMm + p.showersMm + p.precipitationMm) / 8);
    const sunNorm = clamp((p.sunAltitudeDeg + 90) / 180);
    const moonNorm = clamp(p.moonPhase);
    const birdsLevel = clamp(p.birdsLevel ?? 1, 0, 2);
    const chimesLevel = clamp(p.chimesLevel ?? 1, 0, 2);
    const placeDroneLevel = clamp(p.placeDroneLevel ?? 1, 0, 2);
    const airMix = clamp(p.airMix ?? 1, 0, 2);
    const isChaosMode = p.performanceMode === "chaos";
    const trafficReliable = p.trafficReliable === true;

    const placeBaseHz = derivePlaceBaseFrequency(p.latitude, p.longitude);
    const octaveOffset = (x - 0.5) * 2;
    const pitchHz = placeBaseHz * Math.pow(2, octaveOffset);

    const subHz = pitchHz / 2;
    const rootHz = pitchHz;
    const fifthHz = pitchHz * 1.5;
    const octaveHz = pitchHz * 2;

    const brightnessCutoff = 300 + Math.pow(1 - y, 2) * 5000;
    const humiditySoftening = 1 - 0.35 * humidityNorm;
    const baseCutoff = clamp(brightnessCutoff * humiditySoftening, 180, 6200);
    const baseQ = clamp(0.55 + 0.6 * (1 - humidityNorm), 0.5, 1.3);

    const weatherMix = clamp((windNorm + humidityNorm + rainNorm) / 3, 0, 1.8);
    const windLayerLevel = clamp((0.008 + 0.07 * windNorm) * (0.65 + 0.35 * (1 - humidityNorm)), 0, 0.12);
    const rainLayerLevel = clamp((0.001 + 0.05 * rainNorm) * (1 - 0.1 * humidityNorm), 0, 0.05);
    const weatherFilterHz = clamp(260 + 460 * windNorm + 240 * (1 - y), 180, 1200);

    const manMadeAir = p.air;
    const airDensity = clamp(manMadeAir?.normalized.density ?? 0.2 + windNorm * 0.4);
    const airProximity = clamp(
      manMadeAir?.normalized.proximity ?? (manMadeAir?.nearestDistanceKm ? 1 / (1 + manMadeAir.nearestDistanceKm / 30) : 0.2),
    );
    const airMotion = clamp(manMadeAir?.normalized.motion ?? 0.25 + windNorm * 0.4);
    const airTension = clamp(manMadeAir?.normalized.tension ?? 0.2);

    const airNoiseLevel = clamp((0.001 + airDensity * 0.008) * airMix, 0, 0.018);
    const airToneLevel = clamp((0.006 + airProximity * 0.02 + airTension * 0.008) * airMix, 0, 0.045);
    const airNoiseBand = clamp(700 + 500 * airDensity, 650, 1400);
    const airToneHz = clamp(150 + airProximity * 110, 140, 320);
    const airMotionLfoRate = clamp(0.03 + 0.09 * airMotion, 0.03, 0.12);
    const airMotionLfoDepth = clamp(20 + 180 * airMotion, 20, 260);

    const now = ctx.currentTime;
    const dayness = p.isDay ? 1 : 0;
    const morningLift = clamp(1 - Math.abs(sunNorm - 0.3) / 0.25, 0, 1);
    const birdWeatherSuppression = clamp((1 - 0.75 * rainNorm) * (1 - 0.55 * windNorm), 0, 1);
    const birdActivity = clamp((0.2 + 0.8 * dayness) * (0.45 + 0.55 * morningLift) * birdWeatherSuppression * birdsLevel, 0, 2);
    daylifeActivityRef.current += (birdActivity - daylifeActivityRef.current) * 0.12;
    const birdDensity = clamp(0.05 + 1.4 * daylifeActivityRef.current, 0, 2.2);

    const nightness = 1 - dayness;
    const chimeActivityTarget = clamp((0.1 + 0.9 * nightness) * (0.3 + 0.7 * moonNorm) * (1 - 0.55 * precipNorm) * chimesLevel, 0, 2);
    chimeActivityRef.current += (chimeActivityTarget - chimeActivityRef.current) * 0.1;
    const chimeDensity = clamp(0.08 + 0.34 * chimeActivityRef.current, 0.08, 0.55);

    const trafficFromPayload = p.road;
    const trafficDensityColor = clamp(trafficFromPayload?.normalized?.density ?? 0.35);
    const trafficDensity = clamp(trafficFromPayload?.normalized?.density ?? 0.2 + 0.45 * dayness);
    const flow = clamp(trafficFromPayload?.normalized?.motion ?? 0.2 + trafficDensity * 0.7);
    const proximity = clamp(trafficFromPayload?.normalized?.proximity ?? 0.2 + trafficDensity * 0.6);
    const delay = clamp(0.15 + (1 - flow) * 0.18 + trafficDensity * 0.12);
    const internalPulseRate = clamp(1.6 + pressure * 3.1 + (1 - y) * 1.2 + Math.abs(x - 0.5) * 0.8, 1.1, 6.2);
    const pulseRate = isChaosMode ? internalPulseRate : 1 + flow * 5;
    const trafficJitter = delay * 0.25;
    const trafficRumbleGain = clamp(
      (isChaosMode ? 0.03 + trafficDensityColor * 0.045 : trafficDensity * 0.08) * (trafficReliable || !isChaosMode ? 1 : 0.8),
      0,
      0.09,
    );
    const windInfluence = windNorm;
    const rainInfluence = rainNorm;
    const sunInfluence = clamp(p.sunLevel ?? sunNorm, 0, 2);
    const moonInfluence = clamp(p.moonLevel ?? moonNorm, 0, 2);
    const trafficReliabilityScale = trafficReliable ? 1 : 0.45;
    const trafficInfluence = clamp(trafficDensity * (trafficReliable || !isChaosMode ? 1 : 0.8));
    const airInfluence = clamp(airDensity * airMix, 0, 2);
    const weatherBus = clamp(0.55 * windInfluence + 0.45 * rainInfluence, 0, 1);
    const celestialBus = clamp(0.35 * sunInfluence + 0.65 * moonInfluence, 0, 1.5);
    const lifeBus = clamp(0.55 * daylifeActivityRef.current + 0.45 * chimeActivityRef.current, 0, 1.2);
    const airBus = clamp(0.45 * airDensity + 0.3 * airMotion + 0.25 * airProximity, 0, 1);
    const trafficBus = clamp(trafficDensity * trafficReliabilityScale, 0, 1);
    const harborBus = clamp(0.25 * rainInfluence + 0.2 * humidityNorm + 0.55 * trafficBus, 0, 1);
    const environmentalBus = clamp(
      0.25 * weatherBus + 0.2 * celestialBus + 0.16 * airBus + 0.2 * trafficBus + 0.1 * harborBus + 0.09 * lifeBus,
      0,
      1,
    );
    const harmonicOpen = clamp(0.82 + celestialBus * 0.14 - humidityNorm * 0.05, 0.74, 1.02);
    const filterMotion = clamp(1 + windInfluence * 0.1 + airBus * 0.05 - humidityNorm * 0.06, 0.92, 1.14);
    const densityLift = clamp(1 + trafficBus * 0.07 + harborBus * 0.04 + lifeBus * 0.03, 0.97, 1.16);
    const stereoEnergy = clamp(0.045 + airBus * 0.1 + trafficBus * 0.04, 0.04, 0.18);
    const chaosTempoBpm = clamp(p.chaosTempoBpm ?? 100, 60, 160);
    const chaosStepSeconds = 60 / chaosTempoBpm / 4;
    const chaosSwing = clamp((trafficDensityColor - 0.5) * 0.06, -0.03, 0.03);
    const chaosBassRootHz = placeBaseHz / 2;
    const chaosBassHz = clamp(chaosBassRootHz * Math.pow(2, (x - 0.5) * 1.7), 30, 180);
    const chaosBrightness = clamp(520 + Math.pow(1 - y, 2.1) * 5200, 450, 6000);
    const chaosDrive = clamp(0.2 + pressure * 0.8, 0.2, 1);

    if (rainNorm > 0.02 && Math.random() < rainNorm * 0.35) {
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = "triangle";
      click.frequency.value = 900 + Math.random() * 1700;
      clickGain.gain.value = 0.0001;
      click.connect(clickGain);
      clickGain.connect(weatherFilterRef.current!);
      clickGain.gain.setValueAtTime(0.0001, now);
      clickGain.gain.exponentialRampToValueAtTime(0.012 + 0.025 * rainNorm, now + 0.01);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + (0.08 + 0.1 * humidityNorm));
      click.start(now);
      click.stop(now + 0.2);
    }

    if (now >= nextDaylifeEventRef.current && birdActivity > 0.03 && daylifeFilterRef.current) {
      if (Math.random() < birdDensity * 0.28) {
        const chirp = ctx.createOscillator();
        const chirpGain = ctx.createGain();
        const startFreq = 2500 + Math.random() * 1500;
        const endFreq = startFreq + 800 + Math.random() * 1800;
        const dur = 0.08 + Math.random() * 0.1;
        const amp = clamp(0.025 + 0.03 * Math.random(), 0.025, 0.06) * clamp(birdsLevel / 1.4, 0, 1.4);
        chirp.type = Math.random() < 0.5 ? "sine" : "triangle";
        chirp.frequency.setValueAtTime(startFreq, now);
        chirp.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
        chirpGain.gain.setValueAtTime(0.00001, now);
        chirpGain.gain.exponentialRampToValueAtTime(amp, now + 0.005);
        chirpGain.gain.exponentialRampToValueAtTime(0.00001, now + dur);
        chirp.connect(chirpGain);
        chirpGain.connect(daylifeFilterRef.current);
        chirp.start(now);
        chirp.stop(now + dur + 0.02);
        console.log("[audio] bird event", { birdsLevel, birdActivity, startFreq, endFreq, dur, amp });
      }
      nextDaylifeEventRef.current = now + (0.16 + (1 - clamp(birdActivity / 2)) * 0.7) * (0.8 + Math.random() * 0.6);
    }

    if (now >= nextChimeEventRef.current && chimeActivityRef.current > 0.03 && chimeFilterRef.current) {
      if (Math.random() < chimeDensity * 0.35) {
        const base = clamp(420 + Math.random() * 740, 420, 1160);
        const ratios = [1, 1.5, 2.24, 3.17];
        const decay = 2.8 + Math.random() * 3.8;
        const amp = clamp(0.045 + Math.random() * 0.04, 0.045, 0.085) * clamp(chimesLevel / 1.15, 0, 1.8);
        ratios.forEach((ratio, idx) => {
          const part = ctx.createOscillator();
          const partGain = ctx.createGain();
          part.type = "sine";
          part.frequency.setValueAtTime(base * ratio, now);
          partGain.gain.setValueAtTime(0.000001, now);
          partGain.gain.exponentialRampToValueAtTime(amp / (1 + idx * 0.8), now + 0.01);
          partGain.gain.exponentialRampToValueAtTime(0.000001, now + decay * (0.75 + idx * 0.2));
          part.connect(partGain);
          partGain.connect(chimeFilterRef.current!);
          part.start(now);
          part.stop(now + decay * (0.95 + idx * 0.25));
        });
        console.log("[audio] chime event", { chimesLevel, chimeActivity: chimeActivityRef.current, base, decay, amp });
      }
      nextChimeEventRef.current = now + (2.6 + (1 - clamp(chimeActivityRef.current / 2)) * 6.6) * (0.9 + Math.random() * 0.6);
    }

    if (now >= nextAirPassEventRef.current && airMix > 0.01 && airPannerRef.current && airToneFilterRef.current) {
      if (Math.random() < 0.35 + airProximity * 0.45) {
        const passTone = ctx.createOscillator();
        const passGain = ctx.createGain();
        const startFreq = 180 + airProximity * 300;
        const endFreq = 80 + airProximity * 120;
        const dur = 3 + Math.random() * 5;
        const amp = clamp(0.001 + 0.006 * airProximity, 0.001, 0.009) * clamp(airMix / 1.2, 0, 1.6);
        passTone.type = "triangle";
        passTone.frequency.setValueAtTime(startFreq, now);
        passTone.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
        passGain.gain.setValueAtTime(0.000001, now);
        passGain.gain.exponentialRampToValueAtTime(amp, now + 0.35);
        passGain.gain.exponentialRampToValueAtTime(0.000001, now + dur);
        passTone.connect(passGain);
        passGain.connect(airToneFilterRef.current);
        passTone.start(now);
        passTone.stop(now + dur + 0.1);
        const passPan = clamp((Math.random() * 2 - 1) * (0.4 + 0.5 * airProximity), -0.95, 0.95);
        airPannerRef.current.pan.setValueAtTime(-passPan, now);
        airPannerRef.current.pan.linearRampToValueAtTime(passPan, now + dur);
        console.log("[audio] air pass event", { airMix, airDensity, airProximity, airMotion, startFreq, endFreq, dur, amp });
      }
      nextAirPassEventRef.current = now + (4 + (1 - airProximity) * 4) * (0.85 + Math.random() * 0.5);
    }

    if (now >= nextTrafficEventRef.current && trafficFilterRef.current) {
      if (Math.random() < 0.12 + trafficDensity * 0.5) {
        const blip = ctx.createOscillator();
        const blipGain = ctx.createGain();
        const hz = 70 + Math.random() * 180;
        const dur = 0.12 + Math.random() * 0.3;
        const amp = clamp(0.003 + trafficDensity * 0.008 + (isChaosMode ? pressure * 0.002 : 0), 0.0025, 0.013);
        blip.type = "sawtooth";
        blip.frequency.setValueAtTime(hz, now);
        blip.frequency.exponentialRampToValueAtTime(hz * (0.9 + trafficJitter), now + dur);
        blipGain.gain.setValueAtTime(0.00001, now);
        blipGain.gain.exponentialRampToValueAtTime(amp, now + 0.01);
        blipGain.gain.exponentialRampToValueAtTime(0.00001, now + dur);
        blip.connect(blipGain);
        blipGain.connect(trafficFilterRef.current);
        blip.start(now);
        blip.stop(now + dur + 0.03);
        console.log("[audio] traffic event", { trafficDensity, flow, delay, pulseRate, trafficJitter, hz, amp, isChaosMode, trafficReliable });
      }
      nextTrafficEventRef.current = now + (1 / pulseRate) * (0.8 + Math.random() * 0.9 + trafficJitter);
    }

    if (isChaosMode && chaosKickGainRef.current && chaosHatGainRef.current) {
      if (nextChaosPulseRef.current === 0) nextChaosPulseRef.current = now;
      let safety = 0;
      while (now >= nextChaosPulseRef.current && safety < 4) {
        const step = chaosStepRef.current % 16;
        const stepTime = nextChaosPulseRef.current;
        const isKickStep = step % 4 === 0 || (pressure > 0.72 && step % 8 === 6);
        const isHatStep = step % 2 === 0 || (step % 4 === 3 && windNorm > 0.2);
        const isBassStep = step % 8 === 0 || step % 8 === 5;

        if (isKickStep || isBassStep) {
          const kick = ctx.createOscillator();
          const kickGain = ctx.createGain();
          kick.type = pressure > 0.6 ? "triangle" : "sine";
          const bassRatio = isBassStep ? 1.1 : 1.6;
          kick.frequency.setValueAtTime(chaosBassHz * bassRatio, stepTime);
          kick.frequency.exponentialRampToValueAtTime(Math.max(28, chaosBassHz * (isBassStep ? 0.92 : 0.75)), stepTime + 0.1);
          kickGain.gain.setValueAtTime(0.0001, stepTime);
          kickGain.gain.exponentialRampToValueAtTime((isBassStep ? 0.045 : 0.09) + 0.08 * chaosDrive, stepTime + 0.01);
          kickGain.gain.exponentialRampToValueAtTime(0.0001, stepTime + (0.14 + 0.06 * (1 - pressure)));
          kick.connect(kickGain);
          kickGain.connect(chaosKickGainRef.current);
          kick.start(stepTime);
          kick.stop(stepTime + 0.25);
        }

        if (isHatStep) {
          const hat = ctx.createOscillator();
          const hatGain = ctx.createGain();
          hat.type = "square";
          hat.frequency.setValueAtTime(3400 + windNorm * 800 + humidityNorm * 200, stepTime);
          hatGain.gain.setValueAtTime(0.0001, stepTime);
          hatGain.gain.exponentialRampToValueAtTime(0.018 + 0.03 * pressure + 0.014 * windNorm, stepTime + 0.004);
          hatGain.gain.exponentialRampToValueAtTime(0.0001, stepTime + 0.035);
          hat.connect(hatGain);
          hatGain.connect(chaosHatGainRef.current);
          hat.start(stepTime);
          hat.stop(stepTime + 0.05);
        }

        if (chaosDuckGainRef.current && isKickStep) {
          chaosDuckGainRef.current.gain.cancelScheduledValues(stepTime);
          chaosDuckGainRef.current.gain.setValueAtTime(0.88, stepTime);
          chaosDuckGainRef.current.gain.linearRampToValueAtTime(1, stepTime + 0.12);
        }

        chaosStepRef.current = (chaosStepRef.current + 1) % 16;
        const swingOffset = chaosStepRef.current % 2 === 1 ? chaosSwing : 0;
        nextChaosPulseRef.current += chaosStepSeconds + swingOffset;
        safety += 1;
      }
    } else if (!isChaosMode) {
      nextChaosPulseRef.current = 0;
    }

    const master = clamp(0.14 + 0.14 * pressure, 0.12, 0.24);
    const baseDroneMix = clamp((0.22 + 0.16 * pressure) * placeDroneLevel, 0, 0.84);
    const celestialMix = clamp(0.12 + 0.2 * moonNorm, 0, 0.42);
    const lifeMix = clamp(0.06 + 0.24 * birdsLevel * (0.2 + 0.8 * dayness), 0, 0.55);
    const airLayerMix = clamp(airMix * 0.45, 0, 0.8);
    const trafficLayerMix = clamp(isChaosMode ? 0.16 + trafficDensityColor * 0.18 : 0.18 + trafficDensity * 0.28, 0, 0.65);
    const chaosMix = isChaosMode ? clamp(0.22 + pressure * 0.35, 0.2, 0.56) : 0;
    const chaosHatNoiseMix = isChaosMode ? clamp(0.04 + 0.07 * pressure + 0.03 * (windNorm + humidityNorm), 0.035, 0.14) : 0;
    const chaosKickMix = isChaosMode ? clamp(0.7 + pressure * 0.6, 0.7, 1.25) : 0;
    const chaosHatMix = isChaosMode ? clamp(0.55 + pressure * 0.55, 0.5, 1.2) : 0;
    const droneDuck = isChaosMode ? clamp(0.42 - pressure * 0.18, 0.2, 0.42) : 1;
    const monitorState = monitorStateRef.current;
    const gate = (active: boolean) => (active ? 1 : 0);

    subRef.current?.frequency.setTargetAtTime(subHz, now, 0.04);
    rootRef.current?.frequency.setTargetAtTime(rootHz, now, 0.04);
    fifthRef.current?.frequency.setTargetAtTime(fifthHz, now, 0.04);
    octaveRef.current?.frequency.setTargetAtTime(octaveHz, now, 0.04);

    const windMainCutoffMod = clamp(1 - windInfluence * 0.22, 0.72, 1);
    const sunMainBrightness = clamp(1 + sunInfluence * 0.2, 1, 1.35);
    baseFilterRef.current?.frequency.setTargetAtTime(
      isChaosMode ? chaosBrightness : baseCutoff * windMainCutoffMod * sunMainBrightness * harmonicOpen,
      now,
      0.1,
    );
    baseFilterRef.current?.Q.setTargetAtTime(clamp(baseQ * (0.96 + weatherBus * 0.12), 0.5, 1.45), now, 0.1);

    weatherFilterRef.current?.frequency.setTargetAtTime(weatherFilterHz, now, 0.1);
    weatherFilterRef.current?.Q.setTargetAtTime(clamp(0.5 + 0.6 * windNorm, 0.5, 1.4), now, 0.1);
    weatherNoiseGainRef.current?.gain.setTargetAtTime(weatherMix, now, 0.1);
    windGainRef.current?.gain.setTargetAtTime(windLayerLevel * gate(monitorState.wind), now, 0.1);
    rainGainRef.current?.gain.setTargetAtTime(rainLayerLevel * gate(monitorState.rain), now, 0.1);

    airNoiseFilterRef.current?.frequency.setTargetAtTime(airNoiseBand, now, 0.14);
    airNoiseFilterRef.current?.Q.setTargetAtTime(clamp(3.4 + 3.2 * airDensity, 3.4, 7.2), now, 0.14);
    airNoiseGainRef.current?.gain.setTargetAtTime(airNoiseLevel, now, 0.12);
    airToneFilterRef.current?.frequency.setTargetAtTime(clamp(460 + 620 * airProximity, 420, 1250), now, 0.12);
    airToneFilterRef.current?.Q.setTargetAtTime(clamp(6 + 6 * airTension, 6, 12), now, 0.12);
    airToneGainRef.current?.gain.setTargetAtTime(airToneLevel, now, 0.12);
    airToneRef.current?.frequency.setTargetAtTime(airToneHz, now, 0.12);

    const panTarget = clamp(Math.sin(now * (0.03 + 0.09 * airMotion)) * (0.2 + 0.6 * airDensity), -0.9, 0.9);
    airPanDriftRef.current += (panTarget - airPanDriftRef.current) * 0.04;
    airPannerRef.current?.pan.setTargetAtTime(airPanDriftRef.current, now, 0.2);

    daylifeFilterRef.current?.frequency.setTargetAtTime(clamp(2500 + daylifeActivityRef.current * 2600, 2500, 6000), now, 0.18);
    daylifeFilterRef.current?.Q.setTargetAtTime(2.2, now, 0.18);
    daylifeGainRef.current?.gain.setTargetAtTime(clamp(0.14 + 0.35 * daylifeActivityRef.current, 0.1, 0.55), now, 0.2);

    chimeFilterRef.current?.frequency.setTargetAtTime(clamp(700 + moonNorm * 1100, 700, 1800), now, 0.18);
    chimeFilterRef.current?.Q.setTargetAtTime(5.2, now, 0.2);
    chimeGainRef.current?.gain.setTargetAtTime(clamp(0.16 + 0.44 * chimeActivityRef.current, 0.14, 0.75), now, 0.22);

    trafficFilterRef.current?.frequency.setTargetAtTime(clamp(70 + 80 * proximity, 60, 170), now, 0.2);
    trafficFilterRef.current?.Q.setTargetAtTime(clamp(0.6 + 0.8 * proximity, 0.6, 1.5), now, 0.2);
    mainSignalPostFilterRef.current?.frequency.setTargetAtTime(
      clamp((1000 + 2200 * (1 - windInfluence) + 1200 * sunInfluence) * filterMotion, 850, 4600),
      now,
      0.16,
    );
    mainSignalPostFilterRef.current?.Q.setTargetAtTime(
      clamp(0.7 + 0.35 * windInfluence + 0.15 * moonInfluence + environmentalBus * 0.08, 0.7, 1.55),
      now,
      0.16,
    );
    mainSignalShimmerDelayRef.current?.delayTime.setTargetAtTime(
      clamp(0.14 + moonInfluence * 0.07 + airInfluence * 0.02 + celestialBus * 0.015, 0.14, 0.34),
      now,
      0.2,
    );
    mainSignalShimmerGainRef.current?.gain.setTargetAtTime(clamp(0.01 + moonInfluence * 0.07 + celestialBus * 0.01, 0.01, 0.13), now, 0.22);
    mainSignalReverbGainRef.current?.gain.setTargetAtTime(clamp(0.008 + rainInfluence * 0.09 + environmentalBus * 0.012, 0.008, 0.165), now, 0.24);
    mainSignalRainNoiseGainRef.current?.gain.setTargetAtTime(clamp(0.0001 + rainInfluence * 0.006, 0.0001, 0.01), now, 0.12);
    mainSignalCompressorRef.current?.threshold.setTargetAtTime(clamp(-26 + trafficInfluence * 8 + harborBus * 0.7, -26, -14), now, 0.17);
    mainSignalCompressorRef.current?.ratio.setTargetAtTime(clamp(1.8 + trafficInfluence * 1.6 + trafficBus * 0.12, 1.8, 3.45), now, 0.17);
    mainSignalGateRef.current?.gain.setTargetAtTime(
      clamp(
        0.965 +
          Math.sin(now * (0.44 + trafficInfluence * 1.05 + environmentalBus * 0.16)) *
            (0.004 + trafficInfluence * 0.014 + trafficBus * 0.004),
        0.91,
        1.04,
      ),
      now,
      0.14,
    );
    mainSignalStereoRef.current?.pan.setTargetAtTime(
      clamp(Math.sin(now * (0.06 + airInfluence * 0.1 + airBus * 0.04)) * stereoEnergy, -0.45, 0.45),
      now,
      0.24,
    );

    masterGainRef.current?.gain.setTargetAtTime(master, now, 0.12);
    baseDroneGainRef.current?.gain.setTargetAtTime(
      baseDroneMix * droneDuck * gate(monitorState.baseDrone),
      now,
      0.18,
    );
    weatherGainRef.current?.gain.setTargetAtTime(clamp(p.windMps / 20, 0, 2), now, 0.16);
    celestialGainRef.current?.gain.setTargetAtTime(celestialMix * chimesLevel * gate(monitorState.chimes), now, 0.2);
    lifeGainRef.current?.gain.setTargetAtTime(lifeMix * gate(monitorState.birds), now, 0.2);
    airGainRef.current?.gain.setTargetAtTime(airLayerMix * gate(monitorState.air), now, 0.16);
    trafficGainRef.current?.gain.setTargetAtTime(
      trafficLayerMix * trafficRumbleGain * (0.96 + 0.08 * trafficBus) * gate(monitorState.traffic),
      now,
      0.2,
    );
    chaosGainRef.current?.gain.setTargetAtTime(chaosMix * gate(monitorState.traffic), now, 0.08);
    chaosNoiseGainRef.current?.gain.setTargetAtTime(chaosHatNoiseMix, now, 0.08);
    chaosKickGainRef.current?.gain.setTargetAtTime(chaosKickMix, now, 0.04);
    chaosHatGainRef.current?.gain.setTargetAtTime(chaosHatMix, now, 0.04);
    chaosBassFilterRef.current?.frequency.setTargetAtTime(clamp(120 + (1 - y) * 420 + pressure * 220, 90, 700), now, 0.06);
    chaosBassFilterRef.current?.Q.setTargetAtTime(clamp(0.8 + pressure * 1.5, 0.8, 2.4), now, 0.06);
    chaosHatFilterRef.current?.frequency.setTargetAtTime(clamp(2200 + (1 - y) * 5000 + windNorm * 600, 1800, 8200), now, 0.08);

    lfoRef.current?.frequency.setTargetAtTime(clamp(0.06 + 0.35 * sunNorm + weatherBus * 0.04 + trafficBus * 0.03, 0.05, 0.64), now, 0.14);
    lfoGainRef.current?.gain.setTargetAtTime(
      clamp((0.003 + 0.01 * moonNorm + windInfluence * 0.003 + environmentalBus * 0.003) * densityLift, 0.002, 0.022),
      now,
      0.16,
    );
    airMotionLfoRef.current?.frequency.setTargetAtTime(airMotionLfoRate, now, 0.2);
    airMotionGainRef.current?.gain.setTargetAtTime(airMotionLfoDepth, now, 0.2);
  }

  function stop() {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(0.0001, now, 0.05);
    }

    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
    }

    stopTimeoutRef.current = window.setTimeout(async () => {
      try {
        await ctx.suspend();
        setIsRunning(false);
      } catch {
        // ignore
      }
    }, 120);
  }

  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current !== null) {
        window.clearTimeout(stopTimeoutRef.current);
      }

      const ctx = ctxRef.current;
      if (!ctx) return;
      try {
        ctx.close();
      } catch {
        // ignore
      }
      ctxRef.current = null;
      resetGraph();
      setIsRunning(false);
    };
  }, []);

  function setAudioMonitorState(next: AudioMonitorState) {
    monitorStateRef.current = next;
  }

  return { start, update, stop, isRunning, setAudioMonitorState };
}
