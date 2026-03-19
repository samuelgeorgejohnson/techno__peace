import { useEffect, useRef, useState } from "react";

export type MixerLevels = Record<string, number>;

export type AudioParams = {
  x: number;
  y: number;
  pressure: number;
  mixer?: MixerLevels;
};

function clamp(x: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);

  const oscRef = useRef<OscillatorNode | null>(null);
  const subRef = useRef<OscillatorNode | null>(null);
  const noiseSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);

  const oscGainRef = useRef<GainNode | null>(null);
  const subGainRef = useRef<GainNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const noiseFilterRef = useRef<BiquadFilterNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);

  const startedRef = useRef(false);
  const mixerRef = useRef<MixerLevels>({});
  const [isRunning, setIsRunning] = useState(false);

  function ensureContext(): AudioContext {
    if (ctxRef.current) return ctxRef.current;
    const ctx = new (window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    ctxRef.current = ctx;
    return ctx;
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
    masterGainRef.current = masterGain;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;
    filterRef.current = filter;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 110;
    oscRef.current = osc;

    const sub = ctx.createOscillator();
    sub.type = "triangle";
    sub.frequency.value = 55;
    subRef.current = sub;

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.6;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;
    noiseSrc.loop = true;
    noiseSrcRef.current = noiseSrc;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 900;
    noiseFilter.Q.value = 0.6;
    noiseFilterRef.current = noiseFilter;

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.0;
    oscGainRef.current = oscGain;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.0;
    subGainRef.current = subGain;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.0;
    noiseGainRef.current = noiseGain;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.15;
    lfoRef.current = lfo;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.0;
    lfoGainRef.current = lfoGain;

    osc.connect(oscGain);
    oscGain.connect(filter);

    sub.connect(subGain);
    subGain.connect(filter);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(filter);

    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc.start();
    sub.start();
    noiseSrc.start();
    lfo.start();

    startedRef.current = true;
    setIsRunning(true);
  }

  function update(p: AudioParams) {
    const ctx = ctxRef.current;
    if (!ctx || !startedRef.current) return;

    const x = clamp(p.x);
    const y = clamp(p.y);
    const pressure = clamp(p.pressure);

    if (p.mixer) {
      mixerRef.current = p.mixer;
    }

    const levels = mixerRef.current;
    const rain = clamp(levels.rain ?? 0.74);
    const wind = clamp(levels.wind ?? 0.68);
    const thunder = clamp(levels.thunder ?? 0.36);
    const waves = clamp(levels.waves ?? 0.44);
    const traffic = clamp(levels.traffic ?? 0.0);
    const train = clamp(levels.train ?? 0.0);
    const factory = clamp(levels.factory ?? 0.0);
    const harbor = clamp(levels.harbor ?? 0.0);
    const urbanBed = (traffic + train + factory + harbor) / 4;

    const baseHz = 55 + 220 * Math.pow(x, 1.6);
    const subHz = Math.max(28, baseHz / (2 + thunder * 0.6));

    const cutoff = 260 + 4200 * Math.pow(1 - y, 1.6) + wind * 900 - thunder * 260;
    const noiseFilterHz = 280 + wind * 1400 + rain * 320;
    const noiseAmt = 0.01 + 0.11 * pressure + rain * 0.18 + urbanBed * 0.04;
    const oscAmt = 0.025 + 0.08 * pressure + waves * 0.1;
    const subAmt = 0.01 + thunder * 0.14 + pressure * 0.02;
    const master = 0.02 + 0.07 * pressure + (rain + wind + thunder + waves) * 0.02 + urbanBed * 0.02;

    const lfoRate = 0.05 + wind * 1.6 + Math.pow(1 - y, 1.1) * 0.35;
    const lfoDepth = 120 + wind * 420 + waves * 160;

    const now = ctx.currentTime;

    oscRef.current?.frequency.setTargetAtTime(baseHz * (1 + waves * 0.08), now, 0.015);
    subRef.current?.frequency.setTargetAtTime(subHz, now, 0.03);
    filterRef.current?.frequency.setTargetAtTime(cutoff, now, 0.03);
    noiseFilterRef.current?.frequency.setTargetAtTime(noiseFilterHz, now, 0.04);

    oscGainRef.current?.gain.setTargetAtTime(oscAmt, now, 0.03);
    subGainRef.current?.gain.setTargetAtTime(subAmt, now, 0.04);
    noiseGainRef.current?.gain.setTargetAtTime(noiseAmt, now, 0.04);
    masterGainRef.current?.gain.setTargetAtTime(master, now, 0.05);

    lfoRef.current?.frequency.setTargetAtTime(lfoRate, now, 0.04);
    lfoGainRef.current?.gain.setTargetAtTime(lfoDepth, now, 0.04);
  }

  function stop() {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    masterGainRef.current?.gain.setTargetAtTime(0.0001, now, 0.05);

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
