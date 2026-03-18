import { useEffect, useMemo, useRef, useState } from "react";
import type { WeatherAudioMapping } from "../lib/weatherDiagnostics";

export type AudioParams = {
  x: number;
  y: number;
  pressure: number;
};

export interface AudioChannelStatus {
  baseBed: boolean;
  windLayer: boolean;
  rainLayer: boolean;
  thunderLayer: boolean;
  waterLayer: boolean;
  masterOutput: boolean;
  audioContext: AudioContextState | "uninitialized";
}

function clamp(x: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

const DEFAULT_MAPPING: WeatherAudioMapping = {
  windNoiseGain: 0.06,
  windFilterLfo: 0.12,
  lowpassCutoffHz: 1200,
  rainTextureGain: 0.02,
  harmonicBrightness: 0.35,
  thunderEnabled: false,
  sunLfoRateHz: 0.15,
  masterGain: 0.05,
  baseFrequencyHz: 110,
  waterLayerGain: 0.04,
  stormIntensity: 0,
  activeWeatherDrivenChannels: 2,
};

export function useAudioEngine(weatherMapping: WeatherAudioMapping = DEFAULT_MAPPING) {
  const ctxRef = useRef<AudioContext | null>(null);

  const oscRef = useRef<OscillatorNode | null>(null);
  const subRef = useRef<OscillatorNode | null>(null);
  const noiseSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const rainSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const thunderOscRef = useRef<OscillatorNode | null>(null);
  const waterOscRef = useRef<OscillatorNode | null>(null);

  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);
  const thunderGainRef = useRef<GainNode | null>(null);
  const waterGainRef = useRef<GainNode | null>(null);

  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const windLfoRef = useRef<OscillatorNode | null>(null);
  const windLfoGainRef = useRef<GainNode | null>(null);

  const startedRef = useRef(false);
  const pointerRef = useRef<AudioParams>({ x: 0.5, y: 0.5, pressure: 0 });
  const weatherRef = useRef<WeatherAudioMapping>(weatherMapping);

  const [isRunning, setIsRunning] = useState(false);
  const [channelStatus, setChannelStatus] = useState<AudioChannelStatus>({
    baseBed: false,
    windLayer: false,
    rainLayer: false,
    thunderLayer: false,
    waterLayer: false,
    masterOutput: false,
    audioContext: "uninitialized",
  });

  function ensureContext(): AudioContext {
    if (ctxRef.current) return ctxRef.current;
    const ctx = new (window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    ctxRef.current = ctx;
    return ctx;
  }

  function createNoiseSource(ctx: AudioContext, amplitude = 0.6) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * amplitude;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  function syncStatus(mapping: WeatherAudioMapping, contextState: AudioContextState | "uninitialized") {
    setChannelStatus({
      baseBed: startedRef.current,
      windLayer: mapping.windNoiseGain > 0.06,
      rainLayer: mapping.rainTextureGain > 0.08,
      thunderLayer: mapping.thunderEnabled,
      waterLayer: mapping.waterLayerGain > 0.08,
      masterOutput: startedRef.current && contextState === "running",
      audioContext: contextState,
    });
  }

  function applyState(pointer = pointerRef.current, mapping = weatherRef.current) {
    const ctx = ctxRef.current;
    if (!ctx || !startedRef.current) return;

    const x = clamp(pointer.x);
    const y = clamp(pointer.y);
    const pressure = clamp(pointer.pressure);
    const brightness = mapping.harmonicBrightness;

    const baseHz = mapping.baseFrequencyHz + 180 * Math.pow(x, 1.6) + brightness * 55;
    const subHz = Math.max(40, baseHz / 2);
    const cutoff = mapping.lowpassCutoffHz + 1400 * Math.pow(1 - y, 1.4);
    const noiseAmt = mapping.windNoiseGain + 0.1 * pressure + 0.08 * (1 - y);
    const master = mapping.masterGain + 0.1 * pressure;

    const lfoRate = mapping.sunLfoRateHz + 0.75 * Math.pow(1 - y, 1.2);
    const lfoDepth = 0.01 + 0.045 * pressure + brightness * 0.03;

    const rainAmt = mapping.rainTextureGain + pressure * 0.02;
    const thunderAmt = mapping.thunderEnabled ? 0.018 + mapping.stormIntensity * 0.06 : 0.0001;
    const waterAmt = mapping.waterLayerGain + brightness * 0.02;
    const windLfoDepth = 120 + mapping.windFilterLfo * 280;

    const now = ctx.currentTime;

    oscRef.current?.frequency.setTargetAtTime(baseHz, now, 0.02);
    subRef.current?.frequency.setTargetAtTime(subHz, now, 0.03);
    filterRef.current?.frequency.setTargetAtTime(cutoff, now, 0.04);

    noiseGainRef.current?.gain.setTargetAtTime(noiseAmt, now, 0.04);
    gainRef.current?.gain.setTargetAtTime(master, now, 0.04);
    rainGainRef.current?.gain.setTargetAtTime(rainAmt, now, 0.05);
    thunderGainRef.current?.gain.setTargetAtTime(thunderAmt, now, 0.06);
    waterGainRef.current?.gain.setTargetAtTime(waterAmt, now, 0.05);

    lfoRef.current?.frequency.setTargetAtTime(lfoRate, now, 0.04);
    lfoGainRef.current?.gain.setTargetAtTime(lfoDepth, now, 0.04);
    windLfoRef.current?.frequency.setTargetAtTime(0.05 + mapping.windFilterLfo, now, 0.04);
    windLfoGainRef.current?.gain.setTargetAtTime(windLfoDepth, now, 0.05);

    syncStatus(mapping, ctx.state);
  }

  async function start() {
    if (startedRef.current) {
      const ctx = ensureContext();
      if (ctx.state !== "running") await ctx.resume();
      setIsRunning(ctx.state === "running");
      syncStatus(weatherRef.current, ctx.state);
      applyState();
      return;
    }

    const ctx = ensureContext();
    if (ctx.state !== "running") await ctx.resume();

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gainRef.current = gain;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = weatherRef.current.lowpassCutoffHz;
    filter.Q.value = 0.7;
    filterRef.current = filter;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = weatherRef.current.baseFrequencyHz;
    oscRef.current = osc;

    const sub = ctx.createOscillator();
    sub.type = "triangle";
    sub.frequency.value = weatherRef.current.baseFrequencyHz / 2;
    subRef.current = sub;

    const windNoise = createNoiseSource(ctx, 0.6);
    noiseSrcRef.current = windNoise;

    const rainNoise = createNoiseSource(ctx, 0.35);
    rainSrcRef.current = rainNoise;

    const thunderOsc = ctx.createOscillator();
    thunderOsc.type = "sawtooth";
    thunderOsc.frequency.value = 36;
    thunderOscRef.current = thunderOsc;

    const waterOsc = ctx.createOscillator();
    waterOsc.type = "sine";
    waterOsc.frequency.value = 220;
    waterOscRef.current = waterOsc;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.0;
    noiseGainRef.current = noiseGain;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0;
    rainGainRef.current = rainGain;

    const thunderGain = ctx.createGain();
    thunderGain.gain.value = 0.0001;
    thunderGainRef.current = thunderGain;

    const waterGain = ctx.createGain();
    waterGain.gain.value = 0.0001;
    waterGainRef.current = waterGain;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "highpass";
    rainFilter.frequency.value = 1700;

    const waterFilter = ctx.createBiquadFilter();
    waterFilter.type = "bandpass";
    waterFilter.frequency.value = 430;
    waterFilter.Q.value = 2.1;

    const thunderFilter = ctx.createBiquadFilter();
    thunderFilter.type = "lowpass";
    thunderFilter.frequency.value = 140;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = weatherRef.current.sunLfoRateHz;
    lfoRef.current = lfo;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.0;
    lfoGainRef.current = lfoGain;

    const windLfo = ctx.createOscillator();
    windLfo.type = "sine";
    windLfo.frequency.value = 0.2;
    windLfoRef.current = windLfo;

    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 0.0;
    windLfoGainRef.current = windLfoGain;

    osc.connect(filter);
    sub.connect(filter);

    windNoise.connect(noiseGain);
    noiseGain.connect(filter);

    rainNoise.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(gain);

    thunderOsc.connect(thunderFilter);
    thunderFilter.connect(thunderGain);
    thunderGain.connect(gain);

    waterOsc.connect(waterFilter);
    waterFilter.connect(waterGain);
    waterGain.connect(gain);

    filter.connect(gain);
    gain.connect(ctx.destination);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    windLfo.connect(windLfoGain);
    windLfoGain.connect(filter.frequency);

    osc.start();
    sub.start();
    windNoise.start();
    rainNoise.start();
    thunderOsc.start();
    waterOsc.start();
    lfo.start();
    windLfo.start();

    startedRef.current = true;
    setIsRunning(true);
    applyState();
  }

  function update(p: AudioParams) {
    pointerRef.current = p;
    applyState(p, weatherRef.current);
  }

  function applyWeatherMapping(mapping: WeatherAudioMapping) {
    weatherRef.current = mapping;
    applyState(pointerRef.current, mapping);
    syncStatus(mapping, ctxRef.current?.state ?? "uninitialized");
  }

  function stop() {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    gainRef.current?.gain.setTargetAtTime(0.0001, now, 0.05);

    window.setTimeout(async () => {
      await ctx.suspend();
      setIsRunning(false);
      syncStatus(weatherRef.current, ctx.state);
    }, 120);
  }

  useEffect(() => {
    applyWeatherMapping(weatherMapping);
  }, [weatherMapping]);

  useEffect(() => {
    return () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      void ctx.close();
      ctxRef.current = null;
    };
  }, []);

  const debugState = useMemo(
    () => ({
      weatherMapping,
      channelStatus,
    }),
    [channelStatus, weatherMapping]
  );

  return { start, update, stop, isRunning, debugState };
}
