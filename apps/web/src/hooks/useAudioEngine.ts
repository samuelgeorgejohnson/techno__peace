import { useEffect, useRef, useState } from "react";

export type AudioParams = {
  x: number;
  y: number;
  pressure: number;
  precipitationMm: number;
  humidityPct: number;
  windSpeedMps: number;
  windDirectionDeg: number;
  temperatureC: number;
  coordinatePhase: number;
  latInfluence: number;
  rotationPhase: number;
};

function clamp(x: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

function scaleBetween(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const normalized = clamp((value - inMin) / (inMax - inMin || 1));
  return outMin + normalized * (outMax - outMin);
}

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);

  const mainOscRef = useRef<OscillatorNode | null>(null);
  const droneOscRef = useRef<OscillatorNode | null>(null);
  const subRef = useRef<OscillatorNode | null>(null);
  const noiseSrcRef = useRef<AudioBufferSourceNode | null>(null);

  const toneFilterRef = useRef<BiquadFilterNode | null>(null);
  const noiseFilterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const reverbInRef = useRef<GainNode | null>(null);
  const windPanRef = useRef<StereoPannerNode | null>(null);

  const pointerLfoRef = useRef<OscillatorNode | null>(null);
  const pointerLfoGainRef = useRef<GainNode | null>(null);
  const windPanLfoRef = useRef<OscillatorNode | null>(null);
  const windPanLfoGainRef = useRef<GainNode | null>(null);

  const startedRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);

  function ensureContext(): AudioContext {
    if (ctxRef.current) return ctxRef.current;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctxRef.current = ctx;
    return ctx;
  }

  function createImpulse(ctx: AudioContext, durationSec: number, decay: number) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const envelope = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }
    }

    return impulse;
  }

  async function start() {
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
    gainRef.current = masterGain;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.82;
    dryGainRef.current = dryGain;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.12;
    wetGainRef.current = wetGain;

    const reverbInput = ctx.createGain();
    reverbInput.gain.value = 0.3;
    reverbInRef.current = reverbInput;

    const convolver = ctx.createConvolver();
    convolver.buffer = createImpulse(ctx, 2.8, 2.5);

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = "lowpass";
    toneFilter.frequency.value = 1400;
    toneFilter.Q.value = 0.8;
    toneFilterRef.current = toneFilter;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 0.3;
    noiseFilterRef.current = noiseFilter;

    const windPan = ctx.createStereoPanner();
    windPan.pan.value = 0;
    windPanRef.current = windPan;

    const mainOsc = ctx.createOscillator();
    mainOsc.type = "triangle";
    mainOsc.frequency.value = 170;
    mainOscRef.current = mainOsc;

    const droneOsc = ctx.createOscillator();
    droneOsc.type = "sine";
    droneOsc.frequency.value = 48;
    droneOscRef.current = droneOsc;

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 85;
    subRef.current = sub;

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2.0, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.7;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;
    noiseSrc.loop = true;
    noiseSrcRef.current = noiseSrc;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.0;
    noiseGainRef.current = noiseGain;

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.06;
    droneGainRef.current = droneGain;

    const pointerLfo = ctx.createOscillator();
    pointerLfo.type = "sine";
    pointerLfo.frequency.value = 0.15;
    pointerLfoRef.current = pointerLfo;

    const pointerLfoGain = ctx.createGain();
    pointerLfoGain.gain.value = 0.0;
    pointerLfoGainRef.current = pointerLfoGain;

    const windPanLfo = ctx.createOscillator();
    windPanLfo.type = "sine";
    windPanLfo.frequency.value = 0.05;
    windPanLfoRef.current = windPanLfo;

    const windPanLfoGain = ctx.createGain();
    windPanLfoGain.gain.value = 0.0;
    windPanLfoGainRef.current = windPanLfoGain;

    mainOsc.connect(toneFilter);
    sub.connect(toneFilter);
    droneOsc.connect(droneGain);
    droneGain.connect(toneFilter);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(windPan);
    windPan.connect(toneFilter);

    toneFilter.connect(dryGain);
    dryGain.connect(masterGain);

    toneFilter.connect(reverbInput);
    reverbInput.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(masterGain);

    masterGain.connect(ctx.destination);

    pointerLfo.connect(pointerLfoGain);
    pointerLfoGain.connect(masterGain.gain);

    windPanLfo.connect(windPanLfoGain);
    windPanLfoGain.connect(windPan.pan);

    mainOsc.start();
    droneOsc.start();
    sub.start();
    noiseSrc.start();
    pointerLfo.start();
    windPanLfo.start();

    startedRef.current = true;
    setIsRunning(true);
  }

  function update(p: AudioParams) {
    const ctx = ctxRef.current;
    if (!ctx || !startedRef.current) return;

    const x = clamp(p.x);
    const y = clamp(p.y);
    const pressure = clamp(p.pressure);

    const rainNorm = clamp(p.precipitationMm / 12);
    const humidityNorm = clamp(p.humidityPct / 100);
    const windNorm = clamp(p.windSpeedMps / 18);
    const tempNorm = clamp((p.temperatureC + 10) / 45);
    const windPan = clamp(Math.sin((p.windDirectionDeg * Math.PI) / 180), -1, 1);
    const coordinatePhase = clamp((p.coordinatePhase + 1) / 2);
    const latInfluence = clamp((p.latInfluence + 1) / 2);
    const rotationPhase = clamp((p.rotationPhase + 1) / 2);

    const mainHz = scaleBetween(tempNorm, 0, 1, 120, 420) + x * 90 + pressure * 30;
    const subHz = mainHz / (1.9 - latInfluence * 0.35);
    const droneHz = scaleBetween(coordinatePhase, 0, 1, 34, 68) + rotationPhase * 6;

    const cutoff = scaleBetween(tempNorm * 0.7 + (1 - y) * 0.3, 0, 1, 500, 4800);
    const resonance = scaleBetween(humidityNorm, 0, 1, 0.5, 12);
    const rainNoise = 0.03 + rainNorm * 0.18 + pressure * 0.05;
    const master = 0.04 + pressure * 0.08 + rainNorm * 0.04;

    const pointerLfoRate = 0.05 + (1 - y) * 0.9;
    const pointerLfoDepth = 0.01 + pressure * 0.04;

    const reverbWet = scaleBetween(humidityNorm, 0, 1, 0.08, 0.42);
    const dryLevel = 0.95 - reverbWet * 0.4;
    const reverbSend = scaleBetween(humidityNorm, 0, 1, 0.18, 0.56);

    const windLfoRate = 0.03 + windNorm * 0.45;
    const windLfoDepth = 0.02 + windNorm * 0.45;
    const windPanTarget = clamp(windPan * 0.75, -1, 1);
    const noiseBrightness = scaleBetween(tempNorm + windNorm * 0.4, 0, 1.4, 1800, 7000);
    const droneGain = 0.04 + latInfluence * 0.05 + rotationPhase * 0.03;

    const now = ctx.currentTime;

    mainOscRef.current?.frequency.setTargetAtTime(mainHz, now, 0.02);
    subRef.current?.frequency.setTargetAtTime(subHz, now, 0.03);
    droneOscRef.current?.frequency.setTargetAtTime(droneHz, now, 0.08);
    toneFilterRef.current?.frequency.setTargetAtTime(cutoff, now, 0.04);
    toneFilterRef.current?.Q.setTargetAtTime(resonance, now, 0.05);
    noiseFilterRef.current?.frequency.setTargetAtTime(noiseBrightness, now, 0.04);

    noiseGainRef.current?.gain.setTargetAtTime(rainNoise, now, 0.04);
    gainRef.current?.gain.setTargetAtTime(master, now, 0.04);
    droneGainRef.current?.gain.setTargetAtTime(droneGain, now, 0.08);

    dryGainRef.current?.gain.setTargetAtTime(dryLevel, now, 0.06);
    wetGainRef.current?.gain.setTargetAtTime(reverbWet, now, 0.06);
    reverbInRef.current?.gain.setTargetAtTime(reverbSend, now, 0.06);

    pointerLfoRef.current?.frequency.setTargetAtTime(pointerLfoRate, now, 0.03);
    pointerLfoGainRef.current?.gain.setTargetAtTime(pointerLfoDepth, now, 0.03);

    windPanRef.current?.pan.setTargetAtTime(windPanTarget, now, 0.05);
    windPanLfoRef.current?.frequency.setTargetAtTime(windLfoRate, now, 0.05);
    windPanLfoGainRef.current?.gain.setTargetAtTime(windLfoDepth, now, 0.05);
  }

  function stop() {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    if (gainRef.current) {
      gainRef.current.gain.setTargetAtTime(0.0001, now, 0.05);
    }

    setTimeout(async () => {
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
      const ctx = ctxRef.current;
      if (!ctx) return;
      try {
        ctx.close();
      } catch {
        // ignore
      }
      ctxRef.current = null;
    };
  }, []);

  return { start, update, stop, isRunning };
}
