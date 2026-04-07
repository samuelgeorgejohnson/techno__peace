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
  sunAzimuthDeg: number;
  sunriseMs: number;
  sunsetMs: number;
  isDay: boolean;
  moonPhase: number;
  temperatureC: number;

  rainMm: number;
  precipitationMm: number;
  dailyRainMm: number;
  showersMm: number;
};

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function getDayProgress(nowMs: number, sunriseMs: number, sunsetMs: number) {
  if (!sunriseMs || !sunsetMs || sunsetMs <= sunriseMs) return 0;
  return clamp((nowMs - sunriseMs) / (sunsetMs - sunriseMs), 0, 1);
}

function sunIntervalFromDayProgress(dayProgress: number) {
  const sunIntervals = [0, 7, 2, 4, 7, 0];
  const idx = Math.min(sunIntervals.length - 1, Math.floor(dayProgress * sunIntervals.length));
  return sunIntervals[idx];
}

function semitoneRatio(semitones: number) {
  return Math.pow(2, semitones / 12);
}

function getSunFreq(placeFreq: number, dayProgress: number) {
  const semitones = sunIntervalFromDayProgress(dayProgress);
  return placeFreq * semitoneRatio(semitones);
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
  const sunRef = useRef<OscillatorNode | null>(null);
  const noiseSrcRef = useRef<AudioBufferSourceNode | null>(null);

  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sunGainRef = useRef<GainNode | null>(null);
  const sunPanRef = useRef<StereoPannerNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);

  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);

  const startedRef = useRef(false);
  const stopTimeoutRef = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  function resetGraph() {
    oscRef.current = null;
    subRef.current = null;
    sunRef.current = null;
    noiseSrcRef.current = null;
    filterRef.current = null;
    gainRef.current = null;
    sunGainRef.current = null;
    sunPanRef.current = null;
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

    const sun = ctx.createOscillator();
    sun.type = "triangle";
    sun.frequency.value = 110;
    sunRef.current = sun;

    const sunGain = ctx.createGain();
    sunGain.gain.value = 0.0001;
    sunGainRef.current = sunGain;

    const sunPan = ctx.createStereoPanner();
    sunPan.pan.value = 0;
    sunPanRef.current = sunPan;

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
    sun.connect(sunGain);
    sunGain.connect(sunPan);
    sunPan.connect(filter);

    noiseSrc.connect(noiseGain);
    noiseGain.connect(filter);

    filter.connect(gain);
    gain.connect(ctx.destination);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.start();
    sub.start();
    sun.start();
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
    
    // place = home/root/body tone anchored to location
    const placeBaseHz = derivePlaceBaseFrequency(p.latitude, p.longitude);
    const centerTuneSemitones = (x - 0.5) * 12;
    const centerTuneRatio = semitoneRatio(centerTuneSemitones);
    const weatherPitchMod =
      1 +
      0.05 * (tempNorm - 0.5) +
      0.02 * (pressure - 0.5);
    const placeFreq = placeBaseHz * centerTuneRatio * weatherPitchMod;
    const subHz = placeFreq / 2;
    const dayProgress = getDayProgress(Date.now(), p.sunriseMs, p.sunsetMs);
    // sun = moving harmonic companion derived from place
    const sunFreq = getSunFreq(placeFreq, dayProgress);
    const sunAltitudeNorm = clamp((p.sunAltitudeDeg + 5) / 75, 0, 1);
    const sunGain =
      (0.004 + 0.05 * sunAltitudeNorm) * (1 - 0.35 * cloudCover) * (0.75 + 0.25 * dayGate);
    const sunPan = clamp(p.sunAzimuthDeg / 120, -1, 1);

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

    // weather = modulation of the place/sun relationship
    const lfoRate =
      (0.03 + 0.3 * windNorm + 0.12 * sunNorm + 0.22 * Math.pow(1 - y, 1.2)) *
      (0.64 + 0.64 * dayness);
    const lfoDepth =
      (0.016 + 0.13 * moonPhase + 0.05 * pressure + 0.028 * diffusion) *
      (0.66 + 0.72 * dayness);
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

    oscRef.current?.frequency.setTargetAtTime(placeFreq, now, pitchSmoothing);
    subRef.current?.frequency.setTargetAtTime(subHz, now, pitchSmoothing + 0.01);
    sunRef.current?.frequency.setTargetAtTime(sunFreq, now, pitchSmoothing);
    sunGainRef.current?.gain.setTargetAtTime(sunGain, now, gainSmoothing);
    sunPanRef.current?.pan.setTargetAtTime(sunPan, now, toneSmoothing);
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
