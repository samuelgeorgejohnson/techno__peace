import { useEffect, useRef, useState } from "react";

export type AudioParams = {
  x: number;
  y: number;
  pressure: number;
  cloudCover: number;
  windMps: number;
  humidityPct: number;
  sunAltitudeDeg: number;
  moonPhase: number;
  temperatureC: number;
  latitude: number;
  longitude: number;
  elevationM: number;
  placeToneHz: number;
  windMix: number;
  rainMix: number;
  humidityMix: number;

  rainMm: number;
  precipitationMm: number;
  dailyRainMm: number;
  showersMm: number;
};

function clamp(x: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);

  const oscRef = useRef<OscillatorNode | null>(null);
  const subRef = useRef<OscillatorNode | null>(null);
  const noiseSrcRef = useRef<AudioBufferSourceNode | null>(null);

  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);

  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);

  const startedRef = useRef(false);
  const stopTimeoutRef = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  function resetGraph() {
    oscRef.current = null;
    subRef.current = null;
    noiseSrcRef.current = null;
    filterRef.current = null;
    gainRef.current = null;
    noiseGainRef.current = null;
    lfoRef.current = null;
    lfoGainRef.current = null;
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

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gainRef.current = gain;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.6;
    filterRef.current = filter;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 110;
    oscRef.current = osc;

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 55;
    subRef.current = sub;

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;
    noiseSrc.loop = true;
    noiseSrcRef.current = noiseSrc;

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

    osc.connect(filter);
    sub.connect(filter);

    noiseSrc.connect(noiseGain);
    noiseGain.connect(filter);

    filter.connect(gain);
    gain.connect(ctx.destination);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.start();
    sub.start();
    noiseSrc.start();
    lfo.start();

    startedRef.current = true;
    setIsRunning(ctx.state === "running");
  }

  function update(p: AudioParams) {
    const ctx = ctxRef.current;
    if (!ctx || !startedRef.current) return;

    const x = clamp(p.x);
    const y = clamp(p.y);
    const pressure = clamp(p.pressure);
    const cloudCover = clamp(p.cloudCover);
    const windNorm = clamp((p.windMps / 20) * p.windMix, 0, 2);
    const humidityNorm = clamp((p.humidityPct / 100) * p.humidityMix, 0, 2);
    const sunNorm = clamp((p.sunAltitudeDeg + 90) / 180);
    const moonPhase = clamp(p.moonPhase);
    const tempNorm = clamp((p.temperatureC + 10) / 40);
    const elevationNorm = clamp((p.elevationM + 100) / 3100);
    const rainNorm = clamp(((p.rainMm + p.showersMm) / 5) * p.rainMix, 0, 2);
    const wetness = clamp(0.18 + 0.56 * humidityNorm + 0.3 * rainNorm);
    const diffusion = clamp(0.15 + 0.7 * humidityNorm);
    
    const placeToneHz = Math.max(40, Math.min(420, p.placeToneHz));
    const baseHz =
      placeToneHz * (0.64 + 0.22 * sunNorm) +
      24 +
      44 * tempNorm +
      70 * Math.pow(x, 1.4) +
      26 * elevationNorm;
    const subHz = baseHz / 2;

    const cutoffBase = 240 + 2600 * windNorm + 2400 * Math.pow(1 - y, 1.8);
    const cutoff = cutoffBase * (1 - 0.22 * humidityNorm);
    const filterQ = 0.78 - 0.35 * humidityNorm;
    const noiseAmt =
      (0.01 +
        0.18 * windNorm +
        0.08 * cloudCover +
        0.05 * pressure +
        0.6 * rainNorm) *
      (1 - 0.22 * humidityNorm);
    const master =
      0.032 + 0.075 * (1 - cloudCover) + 0.07 * pressure + 0.018 * wetness;

    const lfoRate = 0.04 + 0.6 * sunNorm + 0.55 * Math.pow(1 - y, 1.2);
    const lfoDepth = 0.02 + 0.16 * moonPhase + 0.05 * pressure + 0.03 * diffusion;
    const pitchSmoothing = 0.015 + 0.03 * diffusion;
    const toneSmoothing = 0.02 + 0.055 * diffusion;
    const gainSmoothing = 0.03 + 0.045 * wetness;

    const now = ctx.currentTime;

// 🌧️ rain droplets (random ticks)
if (rainNorm > 0.02 && Math.random() < rainNorm * 0.3) {
  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();

  click.type = "triangle";
  click.frequency.value = 800 + Math.random() * 1200;

  clickGain.gain.value = 0.0001;

  click.connect(clickGain);
  clickGain.connect(filterRef.current!);

  const t = now;
  clickGain.gain.setValueAtTime(0.0001, t);
  clickGain.gain.exponentialRampToValueAtTime(0.02 * rainNorm, t + 0.01);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

  click.start(t);
  click.stop(t + 0.1);
}

    oscRef.current?.frequency.setTargetAtTime(baseHz, now, pitchSmoothing);
    subRef.current?.frequency.setTargetAtTime(subHz, now, pitchSmoothing + 0.01);
    filterRef.current?.frequency.setTargetAtTime(cutoff, now, toneSmoothing);
    filterRef.current?.Q.setTargetAtTime(filterQ, now, toneSmoothing);

    noiseGainRef.current?.gain.setTargetAtTime(noiseAmt, now, gainSmoothing);
    gainRef.current?.gain.setTargetAtTime(master, now, gainSmoothing);

    lfoRef.current?.frequency.setTargetAtTime(lfoRate, now, 0.03);
    lfoGainRef.current?.gain.setTargetAtTime(lfoDepth, now, 0.03);
  }

  function stop() {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    if (gainRef.current) {
      gainRef.current.gain.setTargetAtTime(0.0001, now, 0.05);
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

  return { start, update, stop, isRunning };
}
