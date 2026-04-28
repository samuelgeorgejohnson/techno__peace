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
  const airNoiseSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const airToneRef = useRef<OscillatorNode | null>(null);

  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const airNoiseFilterRef = useRef<BiquadFilterNode | null>(null);
  const airNoiseGainRef = useRef<GainNode | null>(null);
  const airToneFilterRef = useRef<BiquadFilterNode | null>(null);
  const airToneGainRef = useRef<GainNode | null>(null);
  const airPannerRef = useRef<StereoPannerNode | null>(null);
  const airBusGainRef = useRef<GainNode | null>(null);
  const daylifeFilterRef = useRef<BiquadFilterNode | null>(null);
  const daylifeGainRef = useRef<GainNode | null>(null);
  const chimeFilterRef = useRef<BiquadFilterNode | null>(null);
  const chimeGainRef = useRef<GainNode | null>(null);

  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const airShimmerLfoRef = useRef<OscillatorNode | null>(null);
  const airShimmerGainRef = useRef<GainNode | null>(null);
  const daylifeActivityRef = useRef(0);
  const nextDaylifeEventRef = useRef(0);
  const chimeActivityRef = useRef(0);
  const nextChimeEventRef = useRef(0);

  const startedRef = useRef(false);
  const stopTimeoutRef = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  function resetGraph() {
    oscRef.current = null;
    subRef.current = null;
    noiseSrcRef.current = null;
    airNoiseSrcRef.current = null;
    airToneRef.current = null;
    filterRef.current = null;
    gainRef.current = null;
    noiseGainRef.current = null;
    airNoiseFilterRef.current = null;
    airNoiseGainRef.current = null;
    airToneFilterRef.current = null;
    airToneGainRef.current = null;
    airPannerRef.current = null;
    airBusGainRef.current = null;
    daylifeFilterRef.current = null;
    daylifeGainRef.current = null;
    chimeFilterRef.current = null;
    chimeGainRef.current = null;
    lfoRef.current = null;
    lfoGainRef.current = null;
    airShimmerLfoRef.current = null;
    airShimmerGainRef.current = null;
    daylifeActivityRef.current = 0;
    nextDaylifeEventRef.current = 0;
    chimeActivityRef.current = 0;
    nextChimeEventRef.current = 0;
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
    const airNoiseSrc = ctx.createBufferSource();
    airNoiseSrc.buffer = buffer;
    airNoiseSrc.loop = true;
    airNoiseSrcRef.current = airNoiseSrc;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.0;
    noiseGainRef.current = noiseGain;
    const airNoiseFilter = ctx.createBiquadFilter();
    airNoiseFilter.type = "bandpass";
    airNoiseFilter.frequency.value = 1000;
    airNoiseFilter.Q.value = 1.4;
    airNoiseFilterRef.current = airNoiseFilter;

    const airNoiseGain = ctx.createGain();
    airNoiseGain.gain.value = 0.0;
    airNoiseGainRef.current = airNoiseGain;

    const airTone = ctx.createOscillator();
    airTone.type = "triangle";
    airTone.frequency.value = 440;
    airToneRef.current = airTone;

    const airToneFilter = ctx.createBiquadFilter();
    airToneFilter.type = "bandpass";
    airToneFilter.frequency.value = 1100;
    airToneFilter.Q.value = 4.6;
    airToneFilterRef.current = airToneFilter;

    const airToneGain = ctx.createGain();
    airToneGain.gain.value = 0.0;
    airToneGainRef.current = airToneGain;

    const airPanner = ctx.createStereoPanner();
    airPanner.pan.value = 0;
    airPannerRef.current = airPanner;

    const airBusGain = ctx.createGain();
    airBusGain.gain.value = 0.0;
    airBusGainRef.current = airBusGain;
    const daylifeFilter = ctx.createBiquadFilter();
    daylifeFilter.type = "bandpass";
    daylifeFilter.frequency.value = 2400;
    daylifeFilter.Q.value = 2.4;
    daylifeFilterRef.current = daylifeFilter;
    const daylifeGain = ctx.createGain();
    daylifeGain.gain.value = 0.0;
    daylifeGainRef.current = daylifeGain;
    const chimeFilter = ctx.createBiquadFilter();
    chimeFilter.type = "bandpass";
    chimeFilter.frequency.value = 2200;
    chimeFilter.Q.value = 4.8;
    chimeFilterRef.current = chimeFilter;
    const chimeGain = ctx.createGain();
    chimeGain.gain.value = 0.0;
    chimeGainRef.current = chimeGain;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.15;
    lfoRef.current = lfo;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.0;
    lfoGainRef.current = lfoGain;
    const airShimmerLfo = ctx.createOscillator();
    airShimmerLfo.type = "sine";
    airShimmerLfo.frequency.value = 0.2;
    airShimmerLfoRef.current = airShimmerLfo;

    const airShimmerGain = ctx.createGain();
    airShimmerGain.gain.value = 0.0;
    airShimmerGainRef.current = airShimmerGain;

    osc.connect(filter);
    sub.connect(filter);

    noiseSrc.connect(noiseGain);
    noiseGain.connect(filter);
    airNoiseSrc.connect(airNoiseFilter);
    airNoiseFilter.connect(airNoiseGain);
    airNoiseGain.connect(airPanner);

    airTone.connect(airToneFilter);
    airToneFilter.connect(airToneGain);
    airToneGain.connect(airPanner);

    airPanner.connect(airBusGain);
    airBusGain.connect(gain);
    daylifeFilter.connect(daylifeGain);
    daylifeGain.connect(gain);
    chimeFilter.connect(chimeGain);
    chimeGain.connect(gain);

    filter.connect(gain);
    gain.connect(ctx.destination);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    airShimmerLfo.connect(airShimmerGain);
    airShimmerGain.connect(airToneFilter.frequency);

    osc.start();
    sub.start();
    noiseSrc.start();
    airNoiseSrc.start();
    airTone.start();
    lfo.start();
    airShimmerLfo.start();

    startedRef.current = true;
    setIsRunning(ctx.state === "running");
  }

  function update(p: AudioEngineSignalPayload) {
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
    const sunNatural = clamp((p.isDay ? 0.1 : 0.03) + clamp((p.sunAltitudeDeg + 6) / 72) * (p.isDay ? 0.9 : 0.07));
    const moonIllumination = 1 - Math.abs(0.5 - moonPhase) * 2;
    const nightFactor = clamp((-p.sunAltitudeDeg + 6) / 24);
    const moonNatural = clamp((0.2 + 0.8 * moonIllumination) * nightFactor * (p.isDay ? 0.22 : 1));
    const tempNorm = clamp((p.temperatureC + 10) / 40);
    const rainNorm = clamp((p.rainMm + p.showersMm) / 5);
    const precipNorm = clamp((p.rainMm + p.showersMm + p.precipitationMm) / 8);
    const sunLevel = clamp(p.sunLevel, 0, 2);
    const moonLevel = clamp(p.moonLevel, 0, 2);
    const sunInfluence = clamp(sunNatural * sunLevel, 0, 2);
    const moonInfluence = clamp(moonNatural * moonLevel, 0, 2);
    const birdsLevel = clamp(p.birdsLevel ?? 1, 0, 2);
    const chimesLevel = clamp(p.chimesLevel ?? 1, 0, 2);
    const wetness = clamp(0.18 + 0.56 * humidityNorm + 0.3 * rainNorm);
    const diffusion = clamp(0.15 + 0.7 * humidityNorm);

    const placeBaseHz = derivePlaceBaseFrequency(p.latitude, p.longitude);
    const centerTuneSemitones = (x - 0.5) * 24;
    const centerTuneRatio = Math.pow(2, centerTuneSemitones / 12);
    const weatherPitchMod =
      1 +
      0.02 * (sunNorm - 0.5) +
      0.04 * (tempNorm - 0.5) +
      0.025 * (pressure - 0.5) +
      0.015 * (cloudCover - 0.5);
    const baseHz = placeBaseHz * centerTuneRatio * weatherPitchMod;
    const subHz = baseHz / 2;
    const altitudeNorm = clamp((p.altitudeM + 300) / 3600);

    const cutoffBase = 200 + 1900 * windNorm + 2100 * Math.pow(1 - y, 1.8);
    const cutoff =
      cutoffBase *
      (1 - 0.22 * humidityNorm) *
      (0.52 + 0.62 * dayness + 0.4 * sunInfluence) *
      (0.95 + 0.1 * altitudeNorm);
    const filterQ = 0.76 - 0.34 * humidityNorm - 0.06 * sunInfluence;
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
      (0.028 +
        0.36 * sunInfluence +
        0.22 * sunNorm * (0.7 + 0.3 * sunLevel) +
        0.2 * moonInfluence * nightFactor +
        0.4 * Math.pow(1 - y, 1.2)) *
      (0.62 + 0.52 * dayness + 0.08 * sunInfluence);
    const lfoDepth =
      (0.012 +
        0.11 * moonInfluence +
        0.035 * moonPhase +
        0.05 * pressure +
        0.028 * diffusion +
        0.02 * altitudeNorm) *
      (0.52 + 0.38 * dayness + 0.3 * nightFactor);
    const pitchSmoothing = 0.015 + 0.03 * diffusion;
    const toneSmoothing = 0.02 + 0.055 * diffusion;
    const gainSmoothing = 0.03 + 0.045 * wetness;
    const manMadeAir = p.air;
    const airMix = clamp(p.airMix ?? 1);
    const airPresenceNorm = clamp(
      manMadeAir?.normalized.proximity ??
        (manMadeAir?.nearestDistanceKm ? 1 / (1 + manMadeAir.nearestDistanceKm / 30) : 0),
    );
    const airMotionNorm = clamp(
      manMadeAir?.normalized.motion ?? (manMadeAir?.avgVelocityMps ? manMadeAir.avgVelocityMps / 280 : 0),
    );
    const airBrightnessNorm = clamp(
      manMadeAir?.normalized.brightness ??
        (manMadeAir?.avgAltitudeM ? (manMadeAir.avgAltitudeM - 600) / 10800 : 0.25),
    );
    const airTensionNorm = clamp(
      manMadeAir?.normalized.tension ?? (manMadeAir?.headingSpread ? manMadeAir.headingSpread / 180 : 0),
    );
    const hasDopplerRatio = Number.isFinite(manMadeAir?.dopplerRatio);
    const rawDopplerPitchRatio = hasDopplerRatio
      ? clamp(manMadeAir?.dopplerRatio ?? 1, 0.985, 1.015)
      : clamp(Math.pow(2, clamp(manMadeAir?.dopplerCents ?? 0, -12, 12) / 1200), 0.985, 1.015);
    const airActiveGate = manMadeAir ? 1 : 0;
    const airPresence = airActiveGate * airPresenceNorm;
    const dopplerInfluence = 0.25 + 0.35 * airPresence;
    const dopplerPitchRatio = 1 + (rawDopplerPitchRatio - 1) * dopplerInfluence;
    const airVoiceLevel = clamp(0.00002 + 0.012 * airPresence + 0.004 * airMotionNorm, 0, 0.018) * airMix;
    const airNoiseLevel = clamp(airVoiceLevel * (0.38 + 0.55 * airMotionNorm), 0, 0.011);
    const airToneLevel = clamp(airVoiceLevel * (0.16 + 0.52 * airPresence + 0.18 * airTensionNorm), 0, 0.008);
    const airToneBase = baseHz * (3.15 + 0.85 * airBrightnessNorm);
    const airToneHz = clamp(airToneBase * dopplerPitchRatio, 160, 1700);
    const airNoiseBandHz = clamp(680 + 1700 * airBrightnessNorm + 260 * airMotionNorm, 500, 3300);
    const airToneBandHz = clamp(airToneHz * (1.05 + 0.35 * airBrightnessNorm), 280, 3900);
    const airShimmerRate = clamp(0.05 + 0.65 * airMotionNorm + 0.08 * moonInfluence * nightFactor, 0.05, 0.85);
    const airShimmerDepth = clamp(8 + 38 * airMotionNorm + 12 * airTensionNorm + 10 * moonInfluence * nightFactor, 6, 52);
    const airWidth = clamp((airTensionNorm - 0.5) * 1.15, -0.55, 0.55);
    const airPitchSmoothing = 0.08 + 0.09 * diffusion;
    const airToneSmoothing = 0.09 + 0.11 * diffusion;
    const airGainSmoothing = 0.12 + 0.08 * wetness;
    const rainSuppression = clamp(1 - 0.82 * rainNorm);
    const windSuppression = clamp(1 - 0.65 * windNorm);
    const clearBoost = 0.72 + 0.56 * (1 - cloudCover) * dayness;
    const dawnBoost = clamp(1 - Math.abs(sunNorm - 0.3) / 0.26);
    const daylightActivity =
      Math.pow(dayness, 1.35) * rainSuppression * windSuppression * clearBoost * (0.78 + 0.58 * dawnBoost);
    const daylifeTarget = clamp(daylightActivity * birdsLevel, 0, 0.92);
    daylifeActivityRef.current += (daylifeTarget - daylifeActivityRef.current) * 0.14;
    const daylifeActivity = clamp(daylifeActivityRef.current);
    const daylifeDensityPerSec = clamp((0.03 + 0.68 * daylifeActivity) * (0.16 + 0.95 * birdsLevel), 0, 0.9);
    const daylifeGain = clamp((0.00005 + 0.008 * daylifeActivity) * birdsLevel, 0, 0.012);
    const daylifeBrightness = clamp(1300 + 2100 * daylifeActivity + 250 * (1 - cloudCover), 1100, 3800);
    const windModerate = clamp(1 - Math.abs(windNorm - 0.36) / 0.36);
    const windExtremeSuppression = clamp(1 - Math.pow(clamp((windNorm - 0.7) / 0.3), 1.2));
    const rainChimeSuppression = clamp(1 - 0.92 * Math.pow(precipNorm, 0.9));
    const clearChimeLift = 0.78 + 0.42 * (1 - cloudCover);
    const humiditySoftening = 0.88 + 0.12 * (1 - humidityNorm);
    const chimeTarget =
      clamp(windModerate * windExtremeSuppression * rainChimeSuppression * clearChimeLift * humiditySoftening, 0, 1) *
      0.8 *
      chimesLevel;
    chimeActivityRef.current += (chimeTarget - chimeActivityRef.current) * 0.11;
    const chimeActivity = clamp(chimeActivityRef.current);
    const chimeDensityPerSec = clamp((0.01 + 0.18 * chimeActivity) * (0.2 + 0.85 * chimesLevel), 0, 0.26);
    const chimeBrightness = clamp(1700 + 2200 * (1 - cloudCover) + 500 * (1 - precipNorm), 1500, 4200);
    const chimeOutput = clamp((0.00003 + 0.0024 * chimeActivity * rainChimeSuppression) * chimesLevel, 0, 0.0042);

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

    if (now >= nextDaylifeEventRef.current && daylifeActivity > 0.02 && birdsLevel > 0.001 && daylifeFilterRef.current) {
      const triggerProb = daylifeDensityPerSec * 0.52;
      if (Math.random() < triggerProb) {
        const chirp = ctx.createOscillator();
        const chirpGain = ctx.createGain();
        chirp.type = "triangle";
        const chirpStart = daylifeBrightness * (0.9 + Math.random() * 0.7);
        const chirpEnd = chirpStart * (1.08 + Math.random() * 0.2);
        const chirpDur = 0.028 + Math.random() * 0.06;
        const chirpAmp = daylifeGain * (0.72 + Math.random() * 0.86);
        chirp.frequency.setValueAtTime(chirpStart, now);
        chirp.frequency.exponentialRampToValueAtTime(chirpEnd, now + chirpDur);
        chirpGain.gain.setValueAtTime(0.00001, now);
        chirpGain.gain.exponentialRampToValueAtTime(chirpAmp, now + 0.008);
        chirpGain.gain.exponentialRampToValueAtTime(0.00001, now + chirpDur);
        chirp.connect(chirpGain);
        chirpGain.connect(daylifeFilterRef.current);
        chirp.start(now);
        chirp.stop(now + chirpDur + 0.015);
      }
      const intervalBase = 0.16 + (1 - daylifeActivity) * 1.3;
      nextDaylifeEventRef.current = now + intervalBase * (0.9 + Math.random() * 0.55);
    }

    if (now >= nextChimeEventRef.current && chimeActivity > 0.02 && chimesLevel > 0.001 && chimeFilterRef.current) {
      const triggerProb = chimeDensityPerSec * 0.35;
      if (Math.random() < triggerProb) {
        const chimeBase = clamp(
          720 + 440 * windNorm + 340 * (1 - cloudCover) + (Math.random() - 0.5) * 240,
          620,
          1800,
        );
        const ratios = [1, 2.73, 4.11];
        const hitAmp = chimeOutput * (0.6 + Math.random() * 0.65);
        ratios.forEach((ratio, i) => {
          const partial = ctx.createOscillator();
          const partialGain = ctx.createGain();
          partial.type = "sine";
          partial.frequency.setValueAtTime(chimeBase * ratio, now);
          const onset = 0.003 + i * 0.0015;
          const decay = 0.18 + i * 0.18 + Math.random() * 0.28;
          const partialAmp = hitAmp * (i === 0 ? 1 : i === 1 ? 0.45 : 0.24);
          partialGain.gain.setValueAtTime(0.000001, now);
          partialGain.gain.exponentialRampToValueAtTime(partialAmp, now + onset);
          partialGain.gain.exponentialRampToValueAtTime(0.000001, now + onset + decay);
          partial.connect(partialGain);
          partialGain.connect(chimeFilterRef.current!);
          partial.start(now);
          partial.stop(now + onset + decay + 0.02);
        });
      }
      const intervalBase = 1.4 + (1 - chimeActivity) * 5.4;
      nextChimeEventRef.current = now + intervalBase * (0.85 + Math.random() * 0.45);
    }

    oscRef.current?.frequency.setTargetAtTime(baseHz, now, pitchSmoothing);
    subRef.current?.frequency.setTargetAtTime(subHz, now, pitchSmoothing + 0.01);
    filterRef.current?.frequency.setTargetAtTime(cutoff, now, toneSmoothing);
    filterRef.current?.Q.setTargetAtTime(filterQ, now, toneSmoothing);

    noiseGainRef.current?.gain.setTargetAtTime(noiseAmt, now, gainSmoothing);
    gainRef.current?.gain.setTargetAtTime(master, now, gainSmoothing);
    airNoiseGainRef.current?.gain.setTargetAtTime(airNoiseLevel, now, airGainSmoothing);
    airToneGainRef.current?.gain.setTargetAtTime(airToneLevel, now, airGainSmoothing);
    airBusGainRef.current?.gain.setTargetAtTime(airActiveGate * airMix, now, 0.16);
    airNoiseFilterRef.current?.frequency.setTargetAtTime(airNoiseBandHz, now, airToneSmoothing);
    airNoiseFilterRef.current?.Q.setTargetAtTime(0.95 + 0.9 * airTensionNorm, now, airToneSmoothing);
    airToneFilterRef.current?.frequency.setTargetAtTime(airToneBandHz, now, airToneSmoothing);
    airToneFilterRef.current?.Q.setTargetAtTime(3.2 + 1.5 * airTensionNorm, now, airToneSmoothing);
    airToneRef.current?.frequency.setTargetAtTime(airToneHz, now, airPitchSmoothing);
    airPannerRef.current?.pan.setTargetAtTime(airWidth, now, 0.16);
    airShimmerLfoRef.current?.frequency.setTargetAtTime(airShimmerRate, now, 0.16);
    airShimmerGainRef.current?.gain.setTargetAtTime(airShimmerDepth, now, 0.16);
    daylifeFilterRef.current?.frequency.setTargetAtTime(daylifeBrightness, now, 0.2);
    daylifeFilterRef.current?.Q.setTargetAtTime(1.9 + 1.2 * daylifeActivity, now, 0.2);
    daylifeGainRef.current?.gain.setTargetAtTime(daylifeGain, now, 0.22);
    chimeFilterRef.current?.frequency.setTargetAtTime(chimeBrightness, now, 0.24);
    chimeFilterRef.current?.Q.setTargetAtTime(4.2 + 1.7 * (1 - precipNorm), now, 0.24);
    chimeGainRef.current?.gain.setTargetAtTime(chimeOutput, now, 0.26);

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
