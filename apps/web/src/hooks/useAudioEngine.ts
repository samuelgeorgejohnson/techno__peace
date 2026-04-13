import { useEffect, useRef, useState } from "react";

export type AudioParams = {
  x: number;
  y: number;
  pressure: number;
  latitude: number;
  longitude: number;
  cloudCover: number;
  windMps: number;
  humidityPct: number;
  sunAltitudeDeg: number;
  isDay: boolean;
  moonPhase: number;
  temperatureC: number;

  rainMm: number;
  precipitationMm: number;
  dailyRainMm: number;
  showersMm: number;
  windChimesLevel: number;
  windChimeTuning: "place" | "solar" | "lunar" | "harmonic";
};

const CHIME_TUNINGS = {
  place: [0, 2, 7, 9, 12],
  solar: [0, 7, 2, 9, 4],
  lunar: [0, 5, 10, 3, 8],
  harmonic: [0, 7, 12, 14],
} as const;

function semitoneRatio(semitones: number) {
  return Math.pow(2, semitones / 12);
}

function getChimeFreqs(placeFreq: number, tuningName: keyof typeof CHIME_TUNINGS = "place") {
  const intervals = CHIME_TUNINGS[tuningName] || CHIME_TUNINGS.place;
  return intervals.map((semi) => placeFreq * semitoneRatio(semi));
}

function clamp(x: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

function fractional(x: number) {
  return x - Math.floor(x);
}

function derivePlaceBaseFrequency(latitude: number, longitude: number) {
  const lat = clamp((latitude + 90) / 180);
  const lon = clamp((longitude + 180) / 360);
  const seedA = fractional(
    Math.sin((latitude + 90) * 12.9898 + (longitude + 180) * 78.233) * 43758.5453,
  );
  const seedB = fractional(
    Math.sin((latitude + 90) * 39.3467 + (longitude + 180) * 11.1351) * 19642.349,
  );

  const modeSteps = [0, 2, 3, 5, 7, 8, 10];
  const degree = modeSteps[Math.floor(seedA * modeSteps.length)];
  const octave = 2 + Math.floor((0.58 * lat + 0.42 * lon) * 3);
  const baseMidi = 36 + octave * 12 + degree;
  const microDetuneCents = (seedB - 0.5) * 14;

  return 440 * Math.pow(2, (baseMidi - 69) / 12) * Math.pow(2, microDetuneCents / 1200);
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
  const lastChimeStrikeRef = useRef(0);
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
    lastChimeStrikeRef.current = 0;
  }

  function strikeChime(
    ctx: AudioContext,
    destination: AudioNode,
    frequencyHz: number,
    intensity: number,
    brightnessHz: number,
  ) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const tonal = ctx.createGain();
    const brighten = ctx.createBiquadFilter();
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    const out = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = frequencyHz;
    shimmer.type = "sine";
    shimmer.frequency.value = frequencyHz * 2;

    brighten.type = "lowpass";
    brighten.frequency.value = brightnessHz;
    brighten.Q.value = 0.85;

    tonal.gain.value = 0.0001;
    shimmerGain.gain.value = 0.0001;
    out.gain.value = 0.0001;

    osc.connect(tonal);
    shimmer.connect(shimmerGain);
    tonal.connect(brighten);
    shimmerGain.connect(brighten);
    brighten.connect(out);
    out.connect(destination);

    tonal.gain.setValueAtTime(0.0001, now);
    tonal.gain.exponentialRampToValueAtTime(Math.max(0.0002, intensity), now + 0.015);
    tonal.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    shimmerGain.gain.setValueAtTime(0.0001, now);
    shimmerGain.gain.exponentialRampToValueAtTime(Math.max(0.00015, intensity * 0.35), now + 0.01);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);

    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0002, intensity * 0.9), now + 0.02);
    out.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);

    osc.start(now);
    shimmer.start(now);
    osc.stop(now + 1.5);
    shimmer.stop(now + 0.7);
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
    const windNorm = clamp(p.windMps / 20);
    const humidityNorm = clamp(p.humidityPct / 100);
    const sunNorm = clamp((p.sunAltitudeDeg + 90) / 180);
    const dayGate = p.isDay ? 1 : 0;
    const dayLight = clamp(0.15 + 0.85 * sunNorm * 1.06);
    const dayness = clamp(0.68 * dayGate + 0.32 * dayLight);
    const moonPhase = clamp(p.moonPhase);
    const tempNorm = clamp((p.temperatureC + 10) / 40);
    const rainNorm = clamp((p.rainMm + p.showersMm) / 5);
    const wetness = clamp(0.18 + 0.56 * humidityNorm + 0.3 * rainNorm);
    const diffusion = clamp(0.15 + 0.7 * humidityNorm);
    
    const placeFreq = derivePlaceBaseFrequency(p.latitude, p.longitude);
    const centerTuneSemitones = (x - 0.5) * 12;
    const centerTuneRatio = Math.pow(2, centerTuneSemitones / 12);
    const weatherPitchMod =
      1 +
      0.22 * (sunNorm - 0.5) +
      0.18 * (tempNorm - 0.5) +
      0.08 * (pressure - 0.5) +
      0.06 * (cloudCover - 0.5);
    const baseHz = placeFreq * centerTuneRatio * weatherPitchMod;
    const subHz = baseHz / 2;

    const cutoffBase = 200 + 1900 * windNorm + 2100 * Math.pow(1 - y, 1.8);
    const cutoff =
      cutoffBase * (1 - 0.22 * humidityNorm) * (0.52 + 0.76 * dayness);
    const filterQ = 0.78 - 0.35 * humidityNorm;
    const noiseAmt =
      (0.01 +
        0.18 * windNorm +
        0.08 * cloudCover +
        0.05 * pressure +
        0.6 * rainNorm) *
      (1 - 0.22 * humidityNorm) *
      (0.74 + 0.36 * dayness);
    const master =
      (0.022 + 0.06 * (1 - cloudCover) + 0.068 * pressure + 0.016 * wetness) *
      (0.82 + 0.32 * dayness);

    const lfoRate =
      (0.03 + 0.48 * sunNorm + 0.45 * Math.pow(1 - y, 1.2)) *
      (0.64 + 0.64 * dayness);
    const lfoDepth =
      (0.016 + 0.13 * moonPhase + 0.05 * pressure + 0.028 * diffusion) *
      (0.66 + 0.72 * dayness);
    const pitchSmoothing = 0.015 + 0.03 * diffusion;
    const toneSmoothing = 0.02 + 0.055 * diffusion;
    const gainSmoothing = 0.03 + 0.045 * wetness;

    const now = ctx.currentTime;

    // Wind controls activity (timing, density, and strike intensity), not pitch choice.
    // Tuning controls harmonic language by selecting interval presets anchored to placeFreq.
    // placeFreq remains the root reference for every chime tuning preset.
    const levelNorm = clamp(p.windChimesLevel / 100);
    const chimePool = getChimeFreqs(placeFreq, p.windChimeTuning);
    const rainSoftening = 1 - 0.55 * rainNorm;
    const density = clamp((0.08 + 0.92 * windNorm) * rainSoftening * levelNorm);
    const triggerIntervalSec = 1.9 - 1.45 * windNorm;
    const sinceLastStrike = now - lastChimeStrikeRef.current;
    if (
      chimePool.length > 0 &&
      sinceLastStrike >= triggerIntervalSec &&
      Math.random() < 0.18 + density * 0.72
    ) {
      // Optional variation: random note choice stays strictly within the selected tuning pool.
      const freq = chimePool[Math.floor(Math.random() * chimePool.length)];
      const cloudSoftness = 1 - 0.42 * cloudCover;
      const strikeIntensity = (0.012 + 0.085 * windNorm) * cloudSoftness * levelNorm;
      const brightness = 1200 + 2800 * (1 - cloudCover);
      strikeChime(ctx, filterRef.current!, freq, strikeIntensity, brightness);

      // Higher wind can create occasional clustered events without leaving the tuning set.
      if (Math.random() < density * 0.35) {
        const secondFreq = chimePool[Math.floor(Math.random() * chimePool.length)];
        strikeChime(ctx, filterRef.current!, secondFreq, strikeIntensity * 0.72, brightness * 0.9);
      }
      lastChimeStrikeRef.current = now;
    }

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
