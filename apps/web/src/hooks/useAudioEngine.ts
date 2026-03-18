import { useEffect, useRef, useState } from "react";

export type AudioParams = {
  x: number;
  y: number;
  pressure: number;
  spread?: number;
  touchCount?: number;
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
  const stereoRef = useRef<StereoPannerNode | null>(null);

  const startedRef = useRef(false);
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

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gainRef.current = gain;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.6;
    filterRef.current = filter;

    const stereo = ctx.createStereoPanner();
    stereo.pan.value = 0;
    stereoRef.current = stereo;

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
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.6;

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
    gain.connect(stereo);
    stereo.connect(ctx.destination);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

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
    const spread = clamp(p.spread ?? 0);
    const touchCount = Math.max(0, p.touchCount ?? 1);

    const baseHz = 55 + 220 * Math.pow(x, 1.6) + spread * 32;
    const subHz = baseHz / 2;

    const cutoff = 280 + 5000 * Math.pow(1 - y, 1.8) + spread * 900;
    const noiseAmt = 0.02 + 0.15 * pressure + 0.1 * (1 - y) + spread * 0.12;
    const master = 0.035 + 0.09 * pressure + Math.min(touchCount, 4) * 0.01;

    const lfoRate = 0.05 + 1.2 * Math.pow(1 - y, 1.2) + spread * 0.45;
    const lfoDepth = 0.01 + 0.05 * pressure + spread * 0.05;
    const q = 0.6 + spread * 5;
    const pan = clamp((x - 0.5) * 1.8, -1, 1);

    const now = ctx.currentTime;

    oscRef.current?.frequency.setTargetAtTime(baseHz, now, 0.015);
    subRef.current?.frequency.setTargetAtTime(subHz, now, 0.02);
    filterRef.current?.frequency.setTargetAtTime(cutoff, now, 0.02);
    filterRef.current?.Q.setTargetAtTime(q, now, 0.03);

    noiseGainRef.current?.gain.setTargetAtTime(noiseAmt, now, 0.03);
    gainRef.current?.gain.setTargetAtTime(master, now, 0.03);

    lfoRef.current?.frequency.setTargetAtTime(lfoRate, now, 0.03);
    lfoGainRef.current?.gain.setTargetAtTime(lfoDepth, now, 0.03);
    stereoRef.current?.pan.setTargetAtTime(pan, now, 0.03);
  }

  function stop() {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    if (gainRef.current) {
      gainRef.current.gain.setTargetAtTime(0.0001, now, 0.05);
    }

    setTimeout(() => {
      void ctx.suspend().then(() => {
        setIsRunning(false);
      }).catch(() => {
        // ignore
      });
    }, 120);
  }

  useEffect(() => {
    return () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      void ctx.close().catch(() => {
        // ignore
      });
      ctxRef.current = null;
    };
  }, []);

  return { start, update, stop, isRunning };
}
