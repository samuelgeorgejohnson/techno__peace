import { useEffect, useRef, useState } from "react";
import type { WeatherSignal } from "./useCurrentWeatherSignal";

export type AudioParams = {
  x: number;
  y: number;
  pressure: number;
  signalModel: WeatherSignal["signalModel"];
};

const CENTER_MIDI = 50;

function clamp(x: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

function midiToHz(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function azimuthToPan(azimuthDeg: number) {
  return clamp(Math.sin((azimuthDeg * Math.PI) / 180), -1, 1);
}

export function useAudioEngine() {
  const ctxRef = useRef<AudioContext | null>(null);

  // ===== 4-layer drone graph refs =====
  const placeOscRef = useRef<OscillatorNode | null>(null);
  const placeSubRef = useRef<OscillatorNode | null>(null);
  const sunOscRef = useRef<OscillatorNode | null>(null);
  const moonOscRef = useRef<OscillatorNode | null>(null);

  const sunPanRef = useRef<StereoPannerNode | null>(null);
  const moonPanRef = useRef<StereoPannerNode | null>(null);

  const placeGainRef = useRef<GainNode | null>(null);
  const sunGainRef = useRef<GainNode | null>(null);
  const moonGainRef = useRef<GainNode | null>(null);
  const mainGainRef = useRef<GainNode | null>(null);

  const weatherFilterRef = useRef<BiquadFilterNode | null>(null);
  const tempFilterRef = useRef<BiquadFilterNode | null>(null);

  const rainNoiseRef = useRef<AudioBufferSourceNode | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);

  const turbulenceLfoRef = useRef<OscillatorNode | null>(null);
  const turbulenceDepthRef = useRef<GainNode | null>(null);

  const startedRef = useRef(false);
  const stopTimeoutRef = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  function resetGraph() {
    placeOscRef.current = null;
    placeSubRef.current = null;
    sunOscRef.current = null;
    moonOscRef.current = null;

    sunPanRef.current = null;
    moonPanRef.current = null;

    placeGainRef.current = null;
    sunGainRef.current = null;
    moonGainRef.current = null;
    mainGainRef.current = null;

    weatherFilterRef.current = null;
    tempFilterRef.current = null;

    rainNoiseRef.current = null;
    rainGainRef.current = null;

    turbulenceLfoRef.current = null;
    turbulenceDepthRef.current = null;

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

    const placeOsc = ctx.createOscillator();
    placeOsc.type = "sine";
    placeOsc.frequency.value = 110;
    placeOscRef.current = placeOsc;

    const placeSub = ctx.createOscillator();
    placeSub.type = "triangle";
    placeSub.frequency.value = 55;
    placeSubRef.current = placeSub;

    const sunOsc = ctx.createOscillator();
    sunOsc.type = "sawtooth";
    sunOsc.frequency.value = 165;
    sunOscRef.current = sunOsc;

    const moonOsc = ctx.createOscillator();
    moonOsc.type = "sine";
    moonOsc.frequency.value = 82.5;
    moonOscRef.current = moonOsc;

    const placeGain = ctx.createGain();
    placeGain.gain.value = 0.0001;
    placeGainRef.current = placeGain;

    const sunGain = ctx.createGain();
    sunGain.gain.value = 0.0001;
    sunGainRef.current = sunGain;

    const moonGain = ctx.createGain();
    moonGain.gain.value = 0.0001;
    moonGainRef.current = moonGain;

    const sunPan = ctx.createStereoPanner();
    const moonPan = ctx.createStereoPanner();
    sunPanRef.current = sunPan;
    moonPanRef.current = moonPan;

    const weatherFilter = ctx.createBiquadFilter();
    weatherFilter.type = "lowpass";
    weatherFilter.frequency.value = 1400;
    weatherFilter.Q.value = 0.8;
    weatherFilterRef.current = weatherFilter;

    const tempFilter = ctx.createBiquadFilter();
    tempFilter.type = "peaking";
    tempFilter.frequency.value = 420;
    tempFilter.Q.value = 0.9;
    tempFilter.gain.value = 0;
    tempFilterRef.current = tempFilter;

    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.0001;
    mainGainRef.current = mainGain;

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.7;
    const rainNoise = ctx.createBufferSource();
    rainNoise.buffer = noiseBuffer;
    rainNoise.loop = true;
    rainNoiseRef.current = rainNoise;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;
    rainGainRef.current = rainGain;

    const turbulenceLfo = ctx.createOscillator();
    turbulenceLfo.type = "sine";
    turbulenceLfo.frequency.value = 0.12;
    turbulenceLfoRef.current = turbulenceLfo;

    const turbulenceDepth = ctx.createGain();
    turbulenceDepth.gain.value = 0;
    turbulenceDepthRef.current = turbulenceDepth;

    // base routes
    placeOsc.connect(placeGain);
    placeSub.connect(placeGain);

    sunOsc.connect(sunGain);
    sunGain.connect(sunPan);

    moonOsc.connect(moonGain);
    moonGain.connect(moonPan);

    placeGain.connect(weatherFilter);
    sunPan.connect(weatherFilter);
    moonPan.connect(weatherFilter);

    rainNoise.connect(rainGain);
    rainGain.connect(weatherFilter);

    weatherFilter.connect(tempFilter);
    tempFilter.connect(mainGain);
    mainGain.connect(ctx.destination);

    // weather modulation: wind drives turbulence speed/depth
    turbulenceLfo.connect(turbulenceDepth);
    turbulenceDepth.connect(mainGain.gain);

    placeOsc.start();
    placeSub.start();
    sunOsc.start();
    moonOsc.start();
    rainNoise.start();
    turbulenceLfo.start();

    startedRef.current = true;
    setIsRunning(ctx.state === "running");
  }

  function update(p: AudioParams) {
    const ctx = ctxRef.current;
    if (!ctx || !startedRef.current) return;

    const x = clamp(p.x);
    const y = clamp(p.y);
    const pressure = clamp(p.pressure);
    const { location, weather, sun, moon, dailyProfile } = p.signalModel;

    // X pitch mapping: center=home, left=-12st, right=+12st
    const xSemitones = (x - 0.5) * 24;
    const playableHz = midiToHz(CENTER_MIDI + xSemitones);

    // 1) place drone: stable grounded base always on
    const placeHz = location.rootHz * (1 + (dailyProfile.droneSpread - 0.5) * 0.08);

    // 2) sun drone: altitude controls gain and overtone openness, azimuth controls pan
    const sunGain = 0.01 + sun.gain * 0.07;
    const sunHz = placeHz * (1.5 + sun.overtoneOpen * 0.9) * (playableHz / midiToHz(CENTER_MIDI));

    // 3) moon drone: altitude controls gain, phase controls softness/mod depth
    const moonGain = 0.008 + moon.gain * 0.06;
    const moonHz = placeHz * (0.74 + moon.phase * 0.18) * (1 + (0.5 - moon.softness) * 0.05);

    // 4) weather modulation: wind/cloud/rain/temp shape relationship between drones
    const windNorm = clamp(weather.windMps / 18);
    const cloudNorm = clamp(weather.cloudCover);
    const rainNorm = clamp((weather.rainMm + weather.showersMm + weather.precipitationMm) / 6);
    const tempColdNorm = clamp((14 - weather.temperatureC) / 34);
    const tempWarmNorm = 1 - tempColdNorm;

    const dailyCharacter = 0.85 + dailyProfile.textureBias * 0.28 + dailyProfile.warmthBias * 0.16;
    const cutoff = (280 + 2400 * (1 - y)) * (1 - cloudNorm * 0.42) * dailyCharacter;
    const q = 0.5 + windNorm * 0.6 + dailyProfile.turbulence * 0.35;
    const mainGain = (0.025 + pressure * 0.07) * (1 - rainNorm * 0.08);

    const now = ctx.currentTime;
    placeOscRef.current?.frequency.setTargetAtTime(placeHz, now, 0.04);
    placeSubRef.current?.frequency.setTargetAtTime(placeHz / 2, now, 0.05);
    sunOscRef.current?.frequency.setTargetAtTime(sunHz, now, 0.04);
    moonOscRef.current?.frequency.setTargetAtTime(moonHz, now, 0.05);

    placeGainRef.current?.gain.setTargetAtTime(0.03 + pressure * 0.03, now, 0.06);
    sunGainRef.current?.gain.setTargetAtTime(sunGain, now, 0.06);
    moonGainRef.current?.gain.setTargetAtTime(moonGain, now, 0.07);

    sunPanRef.current?.pan.setTargetAtTime(azimuthToPan(sun.azimuthDeg), now, 0.08);
    moonPanRef.current?.pan.setTargetAtTime(azimuthToPan(moon.azimuthDeg), now, 0.1);

    weatherFilterRef.current?.frequency.setTargetAtTime(cutoff, now, 0.06);
    weatherFilterRef.current?.Q.setTargetAtTime(q, now, 0.08);

    // temperature as timbre warmth/coldness, not simple brightness
    tempFilterRef.current?.gain.setTargetAtTime(-4 + tempWarmNorm * 8, now, 0.07);

    rainGainRef.current?.gain.setTargetAtTime(0.002 + rainNorm * 0.11, now, 0.09);

    turbulenceLfoRef.current?.frequency.setTargetAtTime(0.05 + windNorm * 1.2, now, 0.08);
    turbulenceDepthRef.current?.gain.setTargetAtTime(0.0 + windNorm * 0.03 + dailyProfile.turbulence * 0.02, now, 0.09);

    mainGainRef.current?.gain.setTargetAtTime(mainGain, now, 0.08);
  }

  function stop() {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    if (mainGainRef.current) {
      mainGainRef.current.gain.setTargetAtTime(0.0001, now, 0.05);
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
