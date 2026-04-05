import { useEffect, useRef, useState } from "react";

export type AudioParams = {
  x: number;
  y: number;
  pressure: number;
  cloudCover: number;
  windMps: number;
  sunAltitudeDeg: number;
  moonPhase: number;
  temperatureC: number;
  rainMm: number;
  precipitationMm: number;
  dailyRainMm: number;
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
  const rainNormRef = useRef(0);
  const dropletTimerRef = useRef<number | null>(null);

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
    rainNormRef.current = 0;
    startedRef.current = false;
    if (dropletTimerRef.current !== null) {
      window.clearInterval(dropletTimerRef.current);
      dropletTimerRef.current = null;
    }
  }

  function triggerDroplet(ctx: AudioContext, rainNorm: number) {
    const body = filterRef.current;
    if (!body || rainNorm <= 0) return;

    const now = ctx.currentTime;
    const tick = ctx.createOscillator();
    tick.type = "triangle";
    tick.frequency.setValueAtTime(1300 + Math.random() * 2600, now);

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 900 + Math.random() * 1100;
    highpass.Q.value = 0.5;

    const tickGain = ctx.createGain();
    tickGain.gain.value = 0;

    const amp = 0.005 + 0.03 * rainNorm * Math.random();
    const attack = 0.002;
    const decay = 0.025 + Math.random() * 0.055;

    tickGain.gain.setValueAtTime(0.0001, now);
    tickGain.gain.linearRampToValueAtTime(amp, now + attack);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

    tick.connect(highpass);
    highpass.connect(tickGain);
    tickGain.connect(body);

    tick.start(now);
    tick.stop(now + attack + decay + 0.03);
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

    if (dropletTimerRef.current !== null) {
      window.clearInterval(dropletTimerRef.current);
    }
    dropletTimerRef.current = window.setInterval(() => {
      const rainNorm = rainNormRef.current;
      if (rainNorm <= 0.02) return;

      const events = rainNorm > 0.7 ? 2 : 1;
      for (let i = 0; i < events; i++) {
        if (Math.random() < 0.25 + 0.7 * rainNorm) {
          triggerDroplet(ctx, rainNorm);
        }
      }
    }, 120);

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
    const windNorm = clamp(p.windMps / 20);
    const sunNorm = clamp((p.sunAltitudeDeg + 90) / 180);
    const moonPhase = clamp(p.moonPhase);
    const tempNorm = clamp((p.temperatureC + 10) / 40);
    const rainNowMm = Math.max(p.rainMm ?? 0, p.precipitationMm ?? 0);
    const rainNorm = clamp(rainNowMm / 4);
    rainNormRef.current = rainNorm;

    const baseHz = 48 + 110 * sunNorm + 96 * tempNorm + 110 * Math.pow(x, 1.4);
    const subHz = baseHz / 2;

    const cutoff = Math.max(
      140,
      220 + 1800 * windNorm + 2200 * Math.pow(1 - y, 1.8) - 800 * rainNorm,
    );
    const noiseAmt =
      0.01 + 0.12 * windNorm + 0.06 * cloudCover + 0.28 * rainNorm + 0.04 * pressure;
    const master = 0.035 + 0.08 * (1 - cloudCover) + 0.07 * pressure;

    const lfoRate = 0.04 + 0.6 * sunNorm + 0.55 * Math.pow(1 - y, 1.2);
    const lfoDepth = 0.02 + 0.16 * moonPhase + 0.05 * pressure + 0.04 * rainNorm;

    const now = ctx.currentTime;

    oscRef.current?.frequency.setTargetAtTime(baseHz, now, 0.015);
    subRef.current?.frequency.setTargetAtTime(subHz, now, 0.02);
    filterRef.current?.frequency.setTargetAtTime(cutoff, now, 0.02);

    noiseGainRef.current?.gain.setTargetAtTime(noiseAmt, now, 0.03);
    gainRef.current?.gain.setTargetAtTime(master, now, 0.03);

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
