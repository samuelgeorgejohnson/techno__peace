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
  const weatherGainRef = useRef<GainNode | null>(null);
  const celestialGainRef = useRef<GainNode | null>(null);
  const lifeGainRef = useRef<GainNode | null>(null);
  const airGainRef = useRef<GainNode | null>(null);
  const trafficGainRef = useRef<GainNode | null>(null);

  const baseFilterRef = useRef<BiquadFilterNode | null>(null);
  const weatherFilterRef = useRef<BiquadFilterNode | null>(null);
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

  const startedRef = useRef(false);
  const stopTimeoutRef = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

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
    weatherGainRef.current = null;
    celestialGainRef.current = null;
    lifeGainRef.current = null;
    airGainRef.current = null;
    trafficGainRef.current = null;

    baseFilterRef.current = null;
    weatherFilterRef.current = null;
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
    weatherFilter.type = "bandpass";
    weatherFilter.frequency.value = 900;
    weatherFilter.Q.value = 0.8;
    weatherFilterRef.current = weatherFilter;

    const weatherNoiseGain = ctx.createGain();
    weatherNoiseGain.gain.value = 0;
    weatherNoiseGainRef.current = weatherNoiseGain;

    const airNoiseFilter = ctx.createBiquadFilter();
    airNoiseFilter.type = "bandpass";
    airNoiseFilter.frequency.value = 2200;
    airNoiseFilter.Q.value = 1.2;
    airNoiseFilterRef.current = airNoiseFilter;

    const airNoiseGain = ctx.createGain();
    airNoiseGain.gain.value = 0;
    airNoiseGainRef.current = airNoiseGain;

    const airTone = ctx.createOscillator();
    airTone.type = "triangle";
    airTone.frequency.value = 380;
    airToneRef.current = airTone;

    const airToneFilter = ctx.createBiquadFilter();
    airToneFilter.type = "bandpass";
    airToneFilter.frequency.value = 1400;
    airToneFilter.Q.value = 3.2;
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
    trafficFilter.type = "bandpass";
    trafficFilter.frequency.value = 90;
    trafficFilter.Q.value = 0.9;
    trafficFilterRef.current = trafficFilter;

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
    baseFilter.connect(baseDroneGain);

    noiseSrc.connect(weatherFilter);
    weatherFilter.connect(weatherNoiseGain);
    weatherNoiseGain.connect(weatherGain);

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

    baseDroneGain.connect(masterGain);
    weatherGain.connect(masterGain);
    celestialGain.connect(masterGain);
    lifeGain.connect(masterGain);
    airGain.connect(masterGain);
    trafficGain.connect(masterGain);
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
    const airMix = clamp(p.airMix ?? 1, 0, 2);

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
    const weatherNoiseLevel = clamp((0.002 + 0.04 * windNorm + 0.03 * rainNorm) * (1 - 0.2 * humidityNorm), 0, 0.05);
    const weatherFilterHz = clamp(700 + 1800 * (1 - y) + 400 * sunNorm, 400, 3600);

    const manMadeAir = p.air;
    const airDensity = clamp(manMadeAir?.normalized.density ?? 0.2 + windNorm * 0.4);
    const airProximity = clamp(
      manMadeAir?.normalized.proximity ?? (manMadeAir?.nearestDistanceKm ? 1 / (1 + manMadeAir.nearestDistanceKm / 30) : 0.2),
    );
    const airMotion = clamp(manMadeAir?.normalized.motion ?? 0.25 + windNorm * 0.4);
    const airTension = clamp(manMadeAir?.normalized.tension ?? 0.2);

    const airNoiseLevel = clamp((0.002 + airDensity * 0.016) * airMix, 0, 0.03);
    const airToneLevel = clamp((0.001 + airProximity * 0.012 + airTension * 0.004) * airMix, 0, 0.02);
    const airNoiseBand = clamp(1200 + 3200 * airDensity, 1200, 5000);
    const airToneHz = clamp(180 + airProximity * 300, 180, 600);
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
    const chimeDensity = clamp(0.02 + 0.22 * chimeActivityRef.current, 0, 0.4);

    const trafficFromPayload = (p as AudioEngineSignalPayload & { road?: { normalized?: { density?: number; proximity?: number; motion?: number; delay?: number } } }).road;
    const congestion = clamp(trafficFromPayload?.normalized?.density ?? 0.2 + 0.45 * dayness);
    const flow = clamp(trafficFromPayload?.normalized?.motion ?? 0.2 + congestion * 0.7);
    const proximity = clamp(trafficFromPayload?.normalized?.proximity ?? 0.2 + congestion * 0.6);
    const delay = clamp(trafficFromPayload?.normalized?.delay ?? 0.15 + congestion * 0.25);

    const pulseRate = 1 + flow * 5;
    const trafficJitter = delay * 0.25;
    const trafficRumbleGain = clamp(congestion * 0.08, 0, 0.09);
    const trafficFilterHz = clamp(45 + 135 * proximity, 45, 180);

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
        const base = clamp(500 + Math.random() * 1300, 500, 1800);
        const ratios = [1, 2.01, 2.72, 4.13];
        const decay = 1.5 + Math.random() * 2.5;
        const amp = clamp(0.02 + Math.random() * 0.03, 0.02, 0.05) * clamp(chimesLevel / 1.3, 0, 1.5);
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
      nextChimeEventRef.current = now + (1.4 + (1 - clamp(chimeActivityRef.current / 2)) * 4.4) * (0.85 + Math.random() * 0.45);
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
      if (Math.random() < 0.12 + congestion * 0.5) {
        const blip = ctx.createOscillator();
        const blipGain = ctx.createGain();
        const hz = 300 + Math.random() * 600;
        const dur = 0.06 + Math.random() * 0.18;
        const amp = clamp(0.0015 + congestion * 0.005, 0.001, 0.008);
        blip.type = "square";
        blip.frequency.setValueAtTime(hz, now);
        blip.frequency.exponentialRampToValueAtTime(hz * (0.9 + trafficJitter), now + dur);
        blipGain.gain.setValueAtTime(0.00001, now);
        blipGain.gain.exponentialRampToValueAtTime(amp, now + 0.01);
        blipGain.gain.exponentialRampToValueAtTime(0.00001, now + dur);
        blip.connect(blipGain);
        blipGain.connect(trafficFilterRef.current);
        blip.start(now);
        blip.stop(now + dur + 0.03);
        console.log("[audio] traffic event", { congestion, flow, delay, pulseRate, trafficJitter, hz, amp });
      }
      nextTrafficEventRef.current = now + (1 / pulseRate) * (0.8 + Math.random() * 0.9 + trafficJitter);
    }

    const master = clamp(0.14 + 0.14 * pressure, 0.12, 0.24);
    const baseDroneMix = clamp(0.22 + 0.16 * pressure, 0.16, 0.42);
    const celestialMix = clamp(0.12 + 0.2 * moonNorm, 0, 0.42);
    const lifeMix = clamp(0.06 + 0.24 * birdsLevel * (0.2 + 0.8 * dayness), 0, 0.55);
    const airLayerMix = clamp(airMix * 0.45, 0, 0.8);
    const trafficLayerMix = clamp(0.18 + congestion * 0.28, 0, 0.65);

    subRef.current?.frequency.setTargetAtTime(subHz, now, 0.04);
    rootRef.current?.frequency.setTargetAtTime(rootHz, now, 0.04);
    fifthRef.current?.frequency.setTargetAtTime(fifthHz, now, 0.04);
    octaveRef.current?.frequency.setTargetAtTime(octaveHz, now, 0.04);

    baseFilterRef.current?.frequency.setTargetAtTime(baseCutoff, now, 0.08);
    baseFilterRef.current?.Q.setTargetAtTime(baseQ, now, 0.08);

    weatherFilterRef.current?.frequency.setTargetAtTime(weatherFilterHz, now, 0.1);
    weatherFilterRef.current?.Q.setTargetAtTime(clamp(0.7 + 1.1 * windNorm, 0.6, 2.2), now, 0.1);
    weatherNoiseGainRef.current?.gain.setTargetAtTime(weatherNoiseLevel, now, 0.1);

    airNoiseFilterRef.current?.frequency.setTargetAtTime(airNoiseBand, now, 0.14);
    airNoiseFilterRef.current?.Q.setTargetAtTime(clamp(0.8 + 1.3 * airDensity, 0.8, 2.5), now, 0.14);
    airNoiseGainRef.current?.gain.setTargetAtTime(airNoiseLevel, now, 0.12);
    airToneFilterRef.current?.frequency.setTargetAtTime(clamp(1200 + 2400 * airProximity, 1200, 5000), now, 0.12);
    airToneFilterRef.current?.Q.setTargetAtTime(clamp(2 + 2.2 * airTension, 2, 4.5), now, 0.12);
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
    chimeGainRef.current?.gain.setTargetAtTime(clamp(0.08 + 0.24 * chimeActivityRef.current, 0.05, 0.45), now, 0.22);

    trafficFilterRef.current?.frequency.setTargetAtTime(trafficFilterHz, now, 0.2);
    trafficFilterRef.current?.Q.setTargetAtTime(clamp(0.8 + 1.6 * proximity, 0.8, 2.4), now, 0.2);

    masterGainRef.current?.gain.setTargetAtTime(master, now, 0.12);
    baseDroneGainRef.current?.gain.setTargetAtTime(baseDroneMix, now, 0.16);
    weatherGainRef.current?.gain.setTargetAtTime(weatherMix * clamp(p.windMps / 20, 0, 2), now, 0.16);
    celestialGainRef.current?.gain.setTargetAtTime(celestialMix * chimesLevel, now, 0.2);
    lifeGainRef.current?.gain.setTargetAtTime(lifeMix, now, 0.2);
    airGainRef.current?.gain.setTargetAtTime(airLayerMix, now, 0.16);
    trafficGainRef.current?.gain.setTargetAtTime(trafficLayerMix * trafficRumbleGain, now, 0.2);

    lfoRef.current?.frequency.setTargetAtTime(clamp(0.06 + 0.35 * sunNorm, 0.05, 0.6), now, 0.12);
    lfoGainRef.current?.gain.setTargetAtTime(clamp(0.003 + 0.01 * moonNorm, 0.002, 0.015), now, 0.14);
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

  return { start, update, stop, isRunning };
}
