import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CelestialMixerState, CelestialSignals } from "@technopeace/codex-data/types/CelestialSignals";
import type { AirSignal, ManMadeMixerState } from "@technopeace/codex-data/types/ManMadeSignals";
import type { AudioEngineSignalPayload } from "@technopeace/codex-data/types/SignalPayload";
import { MapView } from "@technopeace/codex-map/src/MapView";
import { useLocation } from "@technopeace/codex-map/src/useLocation";
import { derivePlaceBaseFrequency, useAudioEngine } from "../hooks/useAudioEngine";
import { useCurrentWeatherSignal } from "../hooks/useCurrentWeatherSignal";
import { useManMadeAirSignal } from "../hooks/useManMadeAirSignal";
import { getSkyState } from "./getSkyState";
import SplashIntro from "./SplashIntro";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function clampRange(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function fractional(value: number) {
  return value - Math.floor(value);
}

function hashNoise(lat: number, lon: number, seed: number) {
  return fractional(Math.sin((lat + 90) * 11.731 + (lon + 180) * 73.192 + seed * 19.33) * 43758.5453);
}

function toQualitative(value: number, labels: [string, string, string]) {
  if (value < 0.33) return labels[0];
  if (value < 0.66) return labels[1];
  return labels[2];
}

function buildProceduralAirSignal(lat: number, lon: number, isDay: boolean): AirSignal {
  const now = Date.now();
  const phaseSlow = now / (1000 * 60 * 17);
  const phaseMid = now / (1000 * 60 * 9);
  const seedA = hashNoise(lat, lon, 0.7);
  const seedB = hashNoise(lat, lon, 2.3);
  const urbanBias = clamp01(0.24 + 0.26 * (1 - Math.abs(lat) / 90) + 0.16 * Math.abs(Math.sin((lon * Math.PI) / 180)));
  const dayLift = isDay ? 1 : 0;
  const densityBase = isDay ? 0.2 : 0.05;
  const densitySpan = isDay ? 0.42 : 0.16;
  const drift = (Math.sin(phaseSlow + seedA * Math.PI * 2) + 1) / 2;
  const motionDrift = (Math.sin(phaseMid + seedB * Math.PI * 2) + 1) / 2;
  const density = clamp01(densityBase + densitySpan * (0.45 * urbanBias + 0.35 * drift + 0.2 * dayLift));
  const proximity = clamp01(0.08 + 0.6 * urbanBias + 0.22 * motionDrift);
  const motion = clamp01(0.15 + 0.5 * dayLift + 0.25 * drift + 0.1 * motionDrift);
  const nearbyCount = Math.max(0, Math.round(density * (2 + 8 * urbanBias + 5 * dayLift)));

  return {
    count: nearbyCount,
    nearestDistanceKm: Math.max(2, (1 - proximity) * 42),
    avgAltitudeM: 2200 + 6200 * density,
    avgVelocityMps: 145 + 85 * motion,
    headingSpread: 24 + 130 * motion,
    normalized: {
      density,
      proximity,
      motion,
      tension: clamp01(0.25 + 0.4 * motion + 0.2 * density),
      brightness: clamp01(0.24 + 0.56 * density + 0.2 * dayLift),
      pulseRate: 0.45 + density * 1.6,
    },
  };
}

type Pt = { x: number; y: number; pressure: number };
type Channel = { id: string; name: string; detail: string };
type MixerPage = { id: string; title: string; blurb: string; channels: Channel[] };
type DiagnosticSourceStatus = "live" | "fallback" | "unavailable" | "user-controlled";
type DiagnosticRow = {
  category: string;
  label: string;
  raw: string;
  userControl: string;
  effective: string;
  source: DiagnosticSourceStatus;
  note: string;
};

const initialMixerPages: MixerPage[] = [
  {
    id: "weather",
    title: "Weather channels",
    blurb: "Blend the sky's natural voices into the instrument.",
    channels: [
      { id: "rain", name: "Rain", detail: "Soft roof hiss and droplets" },
      { id: "wind", name: "Wind", detail: "Wide gusts and airy movement" },
      { id: "humidity", name: "Humidity", detail: "Diffusion and wet air softness" },
      { id: "birds", name: "Birds", detail: "Daytime chirps and garden life" },
    ],
  },
  {
    id: "celestial",
    title: "Celestial channels",
    blurb: "Balance sunlight and moonlight motion against the weather bed.",
    channels: [
      { id: "sun", name: "Sun", detail: "Daylight tone movement and warmth" },
      { id: "moon", name: "Moon", detail: "Lunar modulation and night drift" },
      { id: "chimes", name: "Chimes", detail: "Sparse bell tones and air shimmer" },
    ],
  },
  {
    id: "man-made",
    title: "Man-made channels",
    blurb: "Shape the urban and mechanical layers around the weather bed.",
    channels: [
      { id: "train", name: "Train", detail: "Steel rhythm and rail hum" },
      { id: "traffic", name: "Traffic", detail: "Passing tires and city motion" },
      { id: "air", name: "Air", detail: "Aircraft movement and sky lanes" },
      { id: "harbor", name: "Harbor", detail: "Buoys, horns, and distant engines" },
    ],
  },
];

const INITIAL_MIX_LEVELS: Record<string, number> = {
  wind: 100,
  rain: 100,
  humidity: 100,
  sun: 100,
  moon: 100,
  birds: 100,
  chimes: 100,
  train: 100,
  traffic: 100,
  air: 100,
  harbor: 100,
};

function FadersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 4V20M12 4V20M18 4V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="4" y="7" width="4" height="4" rx="1.2" fill="currentColor" />
      <rect x="10" y="13" width="4" height="4" rx="1.2" fill="currentColor" />
      <rect x="16" y="9" width="4" height="4" rx="1.2" fill="currentColor" />
    </svg>
  );
}

type SkyInstrumentProps = {
  locationText: string;
  isRequestingLocation: boolean;
  onRequestLocation: () => void;
};

export default function SkyInstrument({
  locationText,
  isRequestingLocation,
  onRequestLocation,
}: SkyInstrumentProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const fadeFrameRef = useRef<number | null>(null);
  const { start, update, isRunning } = useAudioEngine();
  const weather = useCurrentWeatherSignal();

  const [pt, setPt] = useState<Pt>({ x: 0.5, y: 0.5, pressure: 0 });
  const [hasUnlockedAudio, setHasUnlockedAudio] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [activePageId, setActivePageId] = useState(initialMixerPages[0].id);
  const [mixLevels, setMixLevels] = useState<Record<string, number>>(INITIAL_MIX_LEVELS);
  const [hasCompletedSplash, setHasCompletedSplash] = useState(false);
  const [isCompactHud, setIsCompactHud] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const latestPointRef = useRef(pt);
  const { location: activeLocation, setManualLocation } = useLocation();
  const manMadeAir = useManMadeAirSignal(weather.latitude, weather.longitude);

  const overlayVisible = useMemo(() => !hasUnlockedAudio, [hasUnlockedAudio]);
  const dronePressure = 0.58;
  const activePage = useMemo(
    () => initialMixerPages.find((page) => page.id === activePageId) ?? initialMixerPages[0],
    [activePageId],
  );
  const rawWind = clamp01(weather.windMps / 20);
  const rawRain = clamp01((weather.rainMm + weather.showersMm) / 5);
  const rawHumidity = clamp01(weather.humidityPct / 100);
  const windMix = (mixLevels.wind ?? 100) / 100;
  const rainMix = (mixLevels.rain ?? 100) / 100;
  const humidityMix = (mixLevels.humidity ?? 100) / 100;
  const sunMix = (mixLevels.sun ?? 100) / 100;
  const moonMix = (mixLevels.moon ?? 100) / 100;
  const birdsMix = (mixLevels.birds ?? 100) / 100;
  const chimesMix = (mixLevels.chimes ?? 100) / 100;
  const moonIllumination =
    weather.moonPhase <= 0.5 ? weather.moonPhase * 2 : (1 - weather.moonPhase) * 2;
  const moonLightFactor = clamp01(moonIllumination);
  const clearSkyFactor = clamp01(1 - weather.cloudCover);
  const nightFactor = clamp01((-weather.sunAltitudeDeg + 6) / 24);
  const sunRawLive = clamp01((weather.sunAltitudeDeg + 8) / 58) * (weather.isDay ? 1 : 0.2);
  const moonRawLive = clamp01((0.25 + 0.75 * moonIllumination) * nightFactor);
  const effectiveSun = clampRange(sunRawLive * sunMix, 0, 2);
  const effectiveMoon = clampRange(moonRawLive * moonMix, 0, 2);
  const celestialMix: CelestialMixerState = useMemo(
    () => ({ sun: effectiveSun, moon: effectiveMoon }),
    [effectiveMoon, effectiveSun],
  );
  const manMadeMix: ManMadeMixerState = useMemo(
    () => ({
      road: (mixLevels.traffic ?? 100) / 100,
      subway: (mixLevels.train ?? 100) / 100,
      air: (mixLevels.air ?? 100) / 100,
      bus: (mixLevels.harbor ?? 100) / 100,
    }),
    [mixLevels.air, mixLevels.harbor, mixLevels.traffic, mixLevels.train],
  );
  const effectiveWind = clamp01(rawWind * windMix);
  const effectiveRain = clamp01(rawRain * rainMix);
  const effectiveHumidity = clamp01(rawHumidity * humidityMix);
  const celestialSignals: CelestialSignals = useMemo(
    () => ({
      sun: {
        altitudeDeg: weather.sunAltitudeDeg,
        azimuthDeg: 180,
        dayProgress: clamp01((weather.sunAltitudeDeg + 90) / 180),
        isDay: weather.isDay,
        normalized: {
          presence: clamp01((weather.sunAltitudeDeg + 15) / 105),
          motion: effectiveSun,
          brightness: weather.isDay ? 1 : 0.18,
          spatialBias: 0,
          modulationDepth: effectiveSun,
          tension: clamp01(1 - weather.cloudCover),
        },
      },
      moon: {
        altitudeDeg: -weather.sunAltitudeDeg,
        azimuthDeg: 0,
        phase: weather.moonPhase,
        visible: !weather.isDay,
        illumination: moonIllumination,
        normalized: {
          presence: moonRawLive,
          motion: effectiveMoon,
          brightness: clamp01(1 - weather.sunAltitudeDeg / 120),
          spatialBias: 0,
          modulationDepth: effectiveMoon,
          tension: clamp01(moonIllumination),
        },
      },
    }),
    [effectiveMoon, effectiveSun, moonIllumination, moonRawLive, weather.cloudCover, weather.isDay, weather.moonPhase, weather.sunAltitudeDeg],
  );
  const placeBaseHz = useMemo(
    () => derivePlaceBaseFrequency(weather.latitude, weather.longitude),
    [weather.latitude, weather.longitude],
  );
  const currentTonicHz = placeBaseHz * Math.pow(2, ((pt.x - 0.5) * 24) / 12);
  const sky = useMemo(
    () =>
      getSkyState({
        sunAltitudeDeg: weather.sunAltitudeDeg,
        cloudCover: weather.cloudCover,
        windMps: weather.windMps,
        isDay: weather.isDay,
        moonIllumination,
      }),
    [moonIllumination, weather.cloudCover, weather.isDay, weather.sunAltitudeDeg, weather.windMps],
  );
  const nightness = 1 - sky.dayness;
  const moonSkyLift = clamp01(moonLightFactor * clearSkyFactor);
  const starVisibility = clamp01((0.15 + nightness * 1.1) * clearSkyFactor * (0.35 + moonSkyLift * 0.9));
  const cloudAlpha = 0.06 + sky.dayness * 0.18;
  const cloudAlphaDense = 0.18 + sky.dayness * 0.38;
  const weatherSourceStatus: DiagnosticSourceStatus =
    weather.status === "live"
      ? "live"
      : weather.status === "fallback"
        ? "fallback"
        : "unavailable";
  const resolvedAirSignal = useMemo(
    () => manMadeAir.air ?? buildProceduralAirSignal(weather.latitude, weather.longitude, weather.isDay),
    [manMadeAir.air, weather.isDay, weather.latitude, weather.longitude],
  );
  const manMadeSourceStatus: DiagnosticSourceStatus = manMadeAir.status === "live" ? "live" : "fallback";

  const diagnosticsRows: DiagnosticRow[] = useMemo(() => {
    const fmtPercent = (value: number) => `${Math.round(value * 100)}%`;
    const fmtNumber = (value: number, digits = 2) => value.toFixed(digits);
    const rows: DiagnosticRow[] = [
      {
        category: "Weather values",
        label: "Wind",
        raw: `${fmtNumber(weather.windMps, 2)} m/s`,
        userControl: fmtPercent(windMix),
        effective: `${fmtNumber(effectiveWind * 20, 2)} m/s`,
        source: weatherSourceStatus,
        note: "raw weather wind × mixer wind sent to audio payload",
      },
      {
        category: "Weather values",
        label: "Rain",
        raw: `${fmtNumber(weather.rainMm + weather.showersMm, 2)} mm`,
        userControl: fmtPercent(rainMix),
        effective: `${fmtNumber(effectiveRain * 5, 2)} mm`,
        source: weatherSourceStatus,
        note: "rain + showers scaled by mixer rain",
      },
      {
        category: "Weather values",
        label: "Humidity",
        raw: `${fmtNumber(weather.humidityPct, 1)}%`,
        userControl: fmtPercent(humidityMix),
        effective: `${fmtNumber(effectiveHumidity * 100, 1)}%`,
        source: weatherSourceStatus,
        note: "relative humidity scaled by humidity mixer",
      },
      {
        category: "Celestial values",
        label: "Sun modulation",
        raw: fmtPercent(sunRawLive),
        userControl: fmtPercent(sunMix),
        effective: fmtPercent(effectiveSun / 2),
        source: weatherSourceStatus,
        note: "sun altitude day-state mapped then scaled by sun slider",
      },
      {
        category: "Celestial values",
        label: "Moon modulation",
        raw: fmtPercent(moonRawLive),
        userControl: fmtPercent(moonMix),
        effective: fmtPercent(effectiveMoon / 2),
        source: weatherSourceStatus,
        note: "moon illumination/night factor mapped then scaled by moon slider",
      },
      {
        category: "Man-made air values",
        label: "Aircraft density",
        raw: fmtPercent(resolvedAirSignal.normalized.density),
        userControl: fmtPercent(manMadeMix.air ?? 1),
        effective: fmtPercent(resolvedAirSignal.normalized.density * (manMadeMix.air ?? 1)),
        source: manMadeSourceStatus,
        note: "live aircraft density from signal path with air slider mix",
      },
      {
        category: "Man-made air values",
        label: "Aircraft proximity",
        raw: fmtPercent(resolvedAirSignal.normalized.proximity),
        userControl: fmtPercent(manMadeMix.air ?? 1),
        effective: fmtPercent(resolvedAirSignal.normalized.proximity * (manMadeMix.air ?? 1)),
        source: manMadeSourceStatus,
        note: "nearby aircraft presence used for air tone/noise drive",
      },
      {
        category: "Mixer levels",
        label: "Birds slider",
        raw: fmtPercent(weather.isDay ? 1 : 0.2),
        userControl: fmtPercent(birdsMix),
        effective: fmtPercent(clampRange((weather.isDay ? 1 : 0.2) * birdsMix, 0, 2) / 2),
        source: "user-controlled",
        note: "day/night bird gate multiplied by birds slider",
      },
      {
        category: "Mixer levels",
        label: "Chimes slider",
        raw: fmtPercent(0.35 + 0.65 * nightFactor),
        userControl: fmtPercent(chimesMix),
        effective: fmtPercent(clampRange((0.35 + 0.65 * nightFactor) * chimesMix, 0, 2) / 2),
        source: "user-controlled",
        note: "night lift multiplied by chimes slider",
      },
      {
        category: "Mixer levels",
        label: "Traffic / Train / Harbor",
        raw: "manual",
        userControl: `${Math.round((manMadeMix.road ?? 1) * 100)} / ${Math.round((manMadeMix.subway ?? 1) * 100)} / ${Math.round((manMadeMix.bus ?? 1) * 100)}%`,
        effective: "manual",
        source: "user-controlled",
        note: "man-made mixer controls preserved as user channels",
      },
      {
        category: "Final audio modulation values",
        label: "Payload windMps / rainMm / humidityPct",
        raw: `${fmtNumber(weather.windMps, 2)} / ${fmtNumber(weather.rainMm + weather.showersMm, 2)} / ${fmtNumber(weather.humidityPct, 1)}`,
        userControl: `${Math.round(windMix * 100)} / ${Math.round(rainMix * 100)} / ${Math.round(humidityMix * 100)}%`,
        effective: `${fmtNumber(effectiveWind * 20, 2)} / ${fmtNumber(effectiveRain * 5, 2)} / ${fmtNumber(effectiveHumidity * 100, 1)}`,
        source: weatherSourceStatus,
        note: "exact values sent via audio payload on update()",
      },
      {
        category: "Final audio modulation values",
        label: "Payload sunLevel / moonLevel / tonicHz",
        raw: `${fmtPercent(sunRawLive)} / ${fmtPercent(moonRawLive)} / ${fmtNumber(placeBaseHz, 1)} Hz`,
        userControl: `${Math.round(sunMix * 100)} / ${Math.round(moonMix * 100)} / x,y,pointer`,
        effective: `${fmtNumber(effectiveSun, 3)} / ${fmtNumber(effectiveMoon, 3)} / ${fmtNumber(currentTonicHz, 1)} Hz`,
        source: weatherSourceStatus,
        note: "celestial mix and touch position drive final pitch + modulation",
      },
    ];
    return rows;
  }, [birdsMix, chimesMix, currentTonicHz, effectiveHumidity, effectiveMoon, effectiveRain, effectiveSun, effectiveWind, manMadeMix.air, manMadeMix.bus, manMadeMix.road, manMadeMix.subway, manMadeSourceStatus, moonRawLive, nightFactor, placeBaseHz, rainMix, resolvedAirSignal.normalized.density, resolvedAirSignal.normalized.proximity, sunRawLive, sunMix, weather.humidityPct, weather.isDay, weather.rainMm, weather.showersMm, weather.windMps, weatherSourceStatus, windMix, moonMix]);

  const shouldShowSplash =
    !hasCompletedSplash &&
    (weather.status === "live" || weather.status === "fallback" || weather.status === "error");

  const audioParams = useCallback((nextPt: Pt): AudioEngineSignalPayload => {
    return {
      ...nextPt,
      latitude: weather.latitude,
      longitude: weather.longitude,
      altitudeM: weather.altitudeM,
      cloudCover: weather.cloudCover,
      windMps: effectiveWind * 20,
      humidityPct: effectiveHumidity * 100,
      sunAltitudeDeg: weather.sunAltitudeDeg,
      isDay: weather.isDay,
      moonPhase: weather.moonPhase,
      temperatureC: weather.temperatureC,
      rainMm: effectiveRain * 5,
      precipitationMm: weather.precipitationMm,
      dailyRainMm: weather.dailyRainMm,
      showersMm: 0,
      sunLevel: effectiveSun,
      moonLevel: effectiveMoon,
      birdsLevel: birdsMix,
      chimesLevel: chimesMix,
      airMix: manMadeMix.air ?? 1,
      air: resolvedAirSignal,
    };
  }, [birdsMix, chimesMix, effectiveHumidity, effectiveMoon, effectiveRain, effectiveSun, effectiveWind, manMadeMix.air, resolvedAirSignal, weather.altitudeM, weather.cloudCover, weather.dailyRainMm, weather.isDay, weather.latitude, weather.longitude, weather.moonPhase, weather.precipitationMm, weather.sunAltitudeDeg, weather.temperatureC]);

  useEffect(() => {
    if (!isRunning) return;
    update(audioParams(pt));
  }, [audioParams, isRunning, pt, update]);

  useEffect(() => {
    latestPointRef.current = pt;
  }, [pt]);

  useEffect(() => {
    if (!isRunning) return;
    let raf = 0;
    const tick = () => {
      update(audioParams(latestPointRef.current));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [audioParams, isRunning, update]);

  useEffect(
    () => () => {
      if (fadeFrameRef.current !== null) {
        cancelAnimationFrame(fadeFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 768px)");
    const applyMode = (matches: boolean) => {
      setIsCompactHud(matches);
    };

    applyMode(media.matches);
    const onChange = (event: MediaQueryListEvent) => {
      applyMode(event.matches);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function getXY(e: React.PointerEvent) {
    const el = elRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const r = el.getBoundingClientRect();
    const x = clamp01((e.clientX - r.left) / r.width);
    const y = clamp01((e.clientY - r.top) / r.height);
    return { x, y };
  }

  async function unlockAndFadeIn() {
    if (fadeFrameRef.current !== null) {
      cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }

    await start();

    const center = { x: 0.5, y: 0.5, pressure: 0 };
    setPt(center);
    update(audioParams(center));

    const fadeDurationMs = 900;
    const fadeStarted = performance.now();

    const tick = (now: number) => {
      const progress = clamp01((now - fadeStarted) / fadeDurationMs);
      const pressure = dronePressure * progress;
      const nextPt = { x: 0.5, y: 0.5, pressure };

      setPt(nextPt);
      update(audioParams(nextPt));

      if (progress < 1) {
        fadeFrameRef.current = requestAnimationFrame(tick);
      } else {
        fadeFrameRef.current = null;
      }
    };

    fadeFrameRef.current = requestAnimationFrame(tick);
  }

  async function onPointerDown(e: React.PointerEvent) {
    if (mixerOpen || mapOpen || !hasUnlockedAudio) return;

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const { x, y } = getXY(e);
    const pressure = clamp01(Math.max(dronePressure, e.pressure || dronePressure));

    setIsDragging(true);
    setPt({ x, y, pressure });
    update(audioParams({ x, y, pressure }));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (mixerOpen || mapOpen || !hasUnlockedAudio || !isDragging || e.buttons === 0) return;
    const { x, y } = getXY(e);
    const pressure = clamp01(Math.max(dronePressure, e.pressure || dronePressure));

    setPt({ x, y, pressure });
    update(audioParams({ x, y, pressure }));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (mixerOpen || mapOpen || !hasUnlockedAudio) return;
    const { x, y } = getXY(e);
    setIsDragging(false);
    setPt((p) => ({ ...p, x, y, pressure: dronePressure }));
    update(audioParams({ x, y, pressure: dronePressure }));
  }

  function onPointerLeave() {
    if (!hasUnlockedAudio) return;
    setIsDragging(false);
    setPt((p) => ({ ...p, pressure: dronePressure }));
    update(audioParams({ ...pt, pressure: dronePressure }));
  }

  function stopMixerEvent(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  function updateChannelLevel(channelId: string, level: number) {
    setMixLevels((prev) => ({ ...prev, [channelId]: level }));
  }

  function channelDisplayPercent(channelId: string) {
    if (channelId === "wind") return Math.round(effectiveWind * 100);
    if (channelId === "rain") return Math.round(effectiveRain * 100);
    if (channelId === "humidity") return Math.round(effectiveHumidity * 100);
    if (channelId === "sun") return Math.round((celestialMix.sun ?? 1) * 100);
    if (channelId === "moon") return Math.round((celestialMix.moon ?? 1) * 100);
    if (channelId === "birds") return Math.round(clampRange((weather.isDay ? 1 : 0.2) * birdsMix, 0, 2) * 100);
    if (channelId === "chimes") return Math.round(clampRange((0.35 + 0.65 * nightFactor) * chimesMix, 0, 2) * 100);
    if (channelId === "air") return Math.round(resolvedAirSignal.normalized.density * 100);
    return mixLevels[channelId] ?? 100;
  }

  function channelStatusText(channelId: string) {
    if (channelId === "sun") {
      if (weather.isDay) {
        return `Live: altitude ${weather.sunAltitudeDeg.toFixed(0)}° • raw ${Math.round(sunRawLive * 100)}%`;
      }
      return `Live: below horizon ${Math.abs(weather.sunAltitudeDeg).toFixed(0)}° • twilight ${Math.round(sunRawLive * 100)}%`;
    }
    if (channelId === "moon") {
      const phaseLabel =
        weather.moonPhase < 0.1 || weather.moonPhase > 0.9
          ? "new moon"
          : weather.moonPhase < 0.4
            ? "waxing"
          : weather.moonPhase < 0.6
              ? "full moon window"
              : weather.moonPhase < 0.9
                ? "waning"
                : "new moon";
      return `${weather.isDay ? "Day sky" : "Night sky"} • ${phaseLabel} • raw ${Math.round(moonRawLive * 100)}%`;
    }
    if (channelId === "air") {
      if (manMadeAir.status === "loading" || manMadeAir.status === "idle") {
        return "Air: procedural blend warming up";
      }
      if (resolvedAirSignal.count <= 0) {
        return `Air: ${manMadeAir.status === "live" ? "live" : "procedural"} • low activity`;
      }

      const nearestDistance =
        typeof resolvedAirSignal.nearestDistanceKm === "number"
          ? `${resolvedAirSignal.nearestDistanceKm.toFixed(1)}km nearest`
          : "no nearby aircraft";
      const avgVelocity =
        typeof resolvedAirSignal.avgVelocityMps === "number"
          ? `${Math.round(resolvedAirSignal.avgVelocityMps)}m/s avg`
          : "velocity n/a";
      const doppler =
        typeof resolvedAirSignal.dopplerCents === "number"
          ? `${resolvedAirSignal.dopplerCents >= 0 ? "+" : ""}${resolvedAirSignal.dopplerCents.toFixed(1)}c doppler`
          : "doppler n/a";

      return `${manMadeAir.status === "live" ? "Live" : "Procedural"}: ${resolvedAirSignal.count} aircraft • ${nearestDistance} • ${avgVelocity} • ${doppler}`;
    }
    if (channelId === "birds") {
      return weather.isDay ? "Live: daytime chirps • dawn boosted" : "Live: reduced at night";
    }
    if (channelId === "chimes") {
      return weather.isDay ? "Live: sparse wind chimes" : "Live: sparse night bell tones";
    }
    if (channelId === "train" || channelId === "traffic" || channelId === "harbor") {
      return "Manual texture • Not Live";
    }
    return "Manual texture";
  }

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        touchAction: mixerOpen || mapOpen ? "auto" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        background: `linear-gradient(180deg, ${sky.topColor} 0%, ${sky.midColor} 54%, ${sky.horizonColor} 100%)`,
        filter: `brightness(${0.44 + sky.brightness * 0.66}) saturate(${0.72 + sky.dayness * 0.4}) contrast(${0.95 + nightness * 0.14})`,
        transition: "background 900ms ease, filter 900ms ease",
      }}
    >
      <style>
        {`@keyframes tp-cloud-drift-a { from { transform: translateX(-8%); } to { transform: translateX(8%); } }
          @keyframes tp-cloud-drift-b { from { transform: translateX(10%); } to { transform: translateX(-10%); } }`}
      </style>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-6%",
          pointerEvents: "none",
          background:
            "radial-gradient(1.5px 1.5px at 16% 28%, rgba(236,242,255,0.88), rgba(236,242,255,0) 70%), radial-gradient(1.4px 1.4px at 34% 14%, rgba(223,234,255,0.86), rgba(223,234,255,0) 70%), radial-gradient(1.3px 1.3px at 58% 22%, rgba(226,236,255,0.82), rgba(226,236,255,0) 70%), radial-gradient(1.6px 1.6px at 76% 18%, rgba(246,248,255,0.9), rgba(246,248,255,0) 70%), radial-gradient(1.3px 1.3px at 88% 32%, rgba(224,236,255,0.84), rgba(224,236,255,0) 70%), radial-gradient(1.4px 1.4px at 14% 62%, rgba(230,238,255,0.8), rgba(230,238,255,0) 72%), radial-gradient(1.5px 1.5px at 42% 54%, rgba(240,244,255,0.88), rgba(240,244,255,0) 72%), radial-gradient(1.2px 1.2px at 68% 64%, rgba(220,232,255,0.78), rgba(220,232,255,0) 72%), radial-gradient(1.6px 1.6px at 82% 56%, rgba(245,247,255,0.86), rgba(245,247,255,0) 72%), radial-gradient(1.2px 1.2px at 24% 78%, rgba(212,227,255,0.74), rgba(212,227,255,0) 72%), radial-gradient(1.3px 1.3px at 62% 82%, rgba(232,240,255,0.78), rgba(232,240,255,0) 72%), radial-gradient(1.5px 1.5px at 90% 76%, rgba(238,244,255,0.84), rgba(238,244,255,0) 72%)",
          opacity: starVisibility * (sky.phase === "civil-twilight" ? 0.55 : 0.9),
          zIndex: 0,
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-8%",
          pointerEvents: "none",
          background: "radial-gradient(1200px 740px at 50% 52%, rgba(0, 0, 0, 0), rgba(0, 4, 16, 0.55) 72%, rgba(0, 0, 0, 0.86) 100%)",
          opacity: nightness * 0.62,
          zIndex: 0,
          mixBlendMode: "multiply",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-6% -8% 24%",
          pointerEvents: "none",
          background: `radial-gradient(1200px 420px at 50% 98%, rgba(255, 156, 108, ${0.02 + sky.horizonWarmth * 0.36}), rgba(255, 176, 120, 0) 72%)`,
          opacity: 0.08 + sky.dayness * 0.82,
          zIndex: 0,
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-8% -8% -4%",
          pointerEvents: "none",
          background: `radial-gradient(1000px 520px at 50% 88%, rgba(255, 184, 128, ${0.01 + sky.goldenWarmth * 0.34}), rgba(255, 184, 128, 0) 72%)`,
          opacity: 0.04 + sky.dayness * 0.9,
          zIndex: 0,
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-10% -10% -6%",
          pointerEvents: "none",
          background: `radial-gradient(940px 620px at 50% 64%, rgba(222, 234, 255, ${0.04 + moonLightFactor * 0.24}), rgba(255, 255, 255, 0) 74%)`,
          opacity: nightness * (0.34 + moonSkyLift * 0.92),
          zIndex: 0,
          mixBlendMode: "soft-light",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-8%",
          pointerEvents: "none",
          zIndex: 0,
          opacity: sky.cloudOpacity,
          animation: `tp-cloud-drift-a ${Math.max(24, 170 / sky.cloudSpeed)}s linear infinite`,
          background:
            sky.cloudDensity === "low"
              ? `radial-gradient(800px 360px at 18% 20%, rgba(255,255,255,${cloudAlpha}), transparent 62%), radial-gradient(900px 380px at 78% 36%, rgba(255,255,255,${cloudAlpha * 0.92}), transparent 64%)`
              : sky.cloudDensity === "medium"
                ? `linear-gradient(185deg, rgba(255,255,255,${cloudAlphaDense}) 4%, rgba(255,255,255,${cloudAlpha * 0.75}) 20%, rgba(255,255,255,0) 34%), radial-gradient(1000px 420px at 16% 26%, rgba(255,255,255,${cloudAlpha * 1.1}), transparent 66%), radial-gradient(1100px 500px at 74% 34%, rgba(255,255,255,${cloudAlpha}), transparent 70%)`
                : `linear-gradient(180deg, rgba(225,232,242,${0.2 + sky.dayness * 0.35}) 0%, rgba(210,220,236,${0.14 + sky.dayness * 0.24}) 30%, rgba(190,201,219,${0.1 + sky.dayness * 0.2}) 64%, rgba(184,196,214,${0.08 + sky.dayness * 0.18}) 100%)`,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-8%",
          pointerEvents: "none",
          zIndex: 0,
          opacity: sky.cloudOpacity * (sky.cloudDensity === "high" ? 0.75 : 0.48),
          animation: `tp-cloud-drift-b ${Math.max(18, 135 / sky.cloudSpeed)}s linear infinite`,
          background:
            sky.cloudDensity === "high"
              ? "radial-gradient(1200px 520px at 40% 16%, rgba(240,244,250,0.34), transparent 72%), radial-gradient(1200px 540px at 78% 28%, rgba(240,244,250,0.28), transparent 74%)"
              : "radial-gradient(1200px 520px at 12% 26%, rgba(255,255,255,0.20), transparent 72%), radial-gradient(1200px 560px at 86% 30%, rgba(255,255,255,0.16), transparent 74%)",
        }}
      />

      <div
        onPointerDown={stopMixerEvent}
        onPointerMove={stopMixerEvent}
        onPointerUp={stopMixerEvent}
        onPointerCancel={stopMixerEvent}
        onClick={stopMixerEvent}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: mixerOpen ? 4 : 6,
          padding: isCompactHud ? 8 : 12,
          borderRadius: 14,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.9)",
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          backdropFilter: "blur(10px)",
          display: "grid",
          gap: 8,
          minWidth: isCompactHud ? 0 : 220,
          maxWidth: isCompactHud ? 148 : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ letterSpacing: "0.06em", fontWeight: 700, fontSize: isCompactHud ? 10 : 12 }}>
            GEOLOCATION + MIXER
          </div>
          <button
            type="button"
            onPointerDown={stopMixerEvent}
            onPointerUp={stopMixerEvent}
            onClick={(e) => {
              e.stopPropagation();
              setIsCompactHud((prev) => !prev);
            }}
            aria-label={isCompactHud ? "Expand HUD" : "Collapse HUD"}
            style={{
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {isCompactHud ? "Expand" : "Minimize"}
          </button>
        </div>
        <button
          type="button"
          onPointerDown={stopMixerEvent}
          onPointerUp={stopMixerEvent}
          onClick={(e) => {
            e.stopPropagation();
            setMixerOpen((open) => !open);
          }}
          aria-label={mixerOpen ? "Close mixer" : "Open mixer"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: mixerOpen ? "rgba(102, 156, 255, 0.24)" : "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.94)",
            cursor: "pointer",
          }}
        >
          <FadersIcon />
          <span
            style={{
              fontSize: isCompactHud ? 11 : 12,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Mixer
          </span>
        </button>
        <button
          type="button"
          onPointerDown={stopMixerEvent}
          onPointerUp={stopMixerEvent}
          onClick={(e) => {
            e.stopPropagation();
            setDiagnosticsOpen((open) => !open);
          }}
          aria-label={diagnosticsOpen ? "Close diagnostics" : "Open diagnostics"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: diagnosticsOpen ? "rgba(95, 220, 205, 0.22)" : "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.94)",
            cursor: "pointer",
            fontSize: isCompactHud ? 11 : 12,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Diagnostics
        </button>
        <button
          type="button"
          onPointerDown={stopMixerEvent}
          onPointerUp={stopMixerEvent}
          onClick={(e) => {
            e.stopPropagation();
            setMapOpen(true);
          }}
          aria-label="Open place picker"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: mapOpen ? "rgba(131, 233, 181, 0.24)" : "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.94)",
            cursor: "pointer",
            fontSize: isCompactHud ? 11 : 12,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Place
        </button>
        {!isCompactHud && (
          <>
            <div style={{ opacity: 0.9 }}>{locationText}</div>
            <button
              type="button"
              onPointerDown={stopMixerEvent}
              onPointerUp={stopMixerEvent}
              onClick={(e) => {
                e.stopPropagation();
                onRequestLocation();
              }}
              disabled={isRequestingLocation}
              style={{
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)",
                color: "white",
                padding: "8px 10px",
                cursor: isRequestingLocation ? "wait" : "pointer",
              }}
            >
              {isRequestingLocation ? "Requesting..." : "Request location"}
            </button>
            <div>audio: {isRunning ? "on" : "off"}</div>
            <div>
              lat: {weather.latitude.toFixed(4)} lon: {weather.longitude.toFixed(4)}
            </div>
            <div>weather: {weather.status}</div>
            <div>
              moon illum/factor: {Math.round(moonIllumination * 100)}% / {Math.round(moonLightFactor * 100)}%
            </div>
            <div>sky clear factor: {Math.round(clearSkyFactor * 100)}% • star vis: {Math.round(starVisibility * 100)}%</div>
            <div>F₀ base: {placeBaseHz.toFixed(1)} Hz</div>
            <div>tonic now: {currentTonicHz.toFixed(1)} Hz</div>
            <div>wind raw/effective: {Math.round(rawWind * 100)}% / {Math.round(effectiveWind * 100)}%</div>
            <div>rain raw/effective: {Math.round(rawRain * 100)}% / {Math.round(effectiveRain * 100)}%</div>
            <div>
              humidity raw/effective: {Math.round(rawHumidity * 100)}% / {Math.round(effectiveHumidity * 100)}%
            </div>
            <div>celestial: sun {Math.round((celestialSignals.sun?.normalized.motion ?? 1) * 100)}% moon {Math.round((celestialSignals.moon?.normalized.motion ?? 1) * 100)}%</div>
            <div>man-made: road {Math.round((manMadeMix.road ?? 1) * 100)}% subway {Math.round((manMadeMix.subway ?? 1) * 100)}%</div>
            <div>
              air: {resolvedAirSignal.count} nearby • density {toQualitative(resolvedAirSignal.normalized.density, ["low", "medium", "high"])} • motion {toQualitative(resolvedAirSignal.normalized.motion, ["steady", "active", "busy"])}
            </div>
          </>
        )}
      </div>
      {diagnosticsOpen && (
        <div
          onPointerDown={stopMixerEvent}
          onPointerMove={stopMixerEvent}
          onPointerUp={stopMixerEvent}
          onPointerCancel={stopMixerEvent}
          onClick={stopMixerEvent}
          style={{
            position: "absolute",
            top: isCompactHud ? 164 : 252,
            left: 16,
            zIndex: 7,
            width: "min(980px, calc(100vw - 32px))",
            maxHeight: "min(62vh, 560px)",
            overflow: "auto",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(4, 8, 20, 0.84)",
            backdropFilter: "blur(12px)",
            padding: 12,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "rgba(255,255,255,0.92)" }}>
            <thead>
              <tr>
                {["Category", "Label", "Raw", "User", "Effective", "Source", "Note"].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      textAlign: "left",
                      padding: "8px 6px",
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      borderBottom: "1px solid rgba(255,255,255,0.14)",
                      color: "rgba(188, 215, 255, 0.88)",
                      position: "sticky",
                      top: 0,
                      background: "rgba(4, 8, 20, 0.96)",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {diagnosticsRows.map((row, index) => (
                <tr key={`${row.category}-${row.label}-${index}`}>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(176, 214, 255, 0.9)" }}>{row.category}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{row.label}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{row.raw}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{row.userControl}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{row.effective}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.08)", textTransform: "lowercase" }}>{row.source}</td>
                  <td style={{ padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.72)" }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mapOpen && (
        <div
          onPointerDown={stopMixerEvent}
          onPointerMove={stopMixerEvent}
          onPointerUp={stopMixerEvent}
          onPointerCancel={stopMixerEvent}
          onClick={stopMixerEvent}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 8,
            background: "rgba(5, 10, 24, 0.74)",
            backdropFilter: "blur(8px)",
            padding: 16,
            display: "grid",
            gridTemplateRows: "auto 1fr",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700, letterSpacing: "0.08em" }}>
              Place Picker
            </div>
            <button
              type="button"
              onPointerDown={stopMixerEvent}
              onPointerUp={stopMixerEvent}
              onClick={(e) => {
                e.stopPropagation();
                setMapOpen(false);
              }}
              style={{
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)",
                color: "white",
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Back to Sky
            </button>
          </div>
          <MapView
            location={activeLocation}
            onLocationChange={(bundle) => {
              setManualLocation(bundle);
            }}
            style={{ minHeight: "calc(100vh - 120px)", borderRadius: 18 }}
          />
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: `calc(${pt.x * 100}% - 20px)`,
          top: `calc(${pt.y * 100}% - 20px)`,
          width: 40,
          height: 40,
          borderRadius: 999,
          background: "rgba(180, 220, 255, 0.85)",
          filter: "blur(0px)",
          boxShadow: "0 0 40px rgba(140,200,255,0.35)",
          transform: `scale(${1 + pt.pressure * 0.8})`,
          transition: "transform 40ms linear",
          pointerEvents: "none",
          opacity: mixerOpen ? 0.35 : 0.9,
          zIndex: 1,
        }}
      />

      {mixerOpen && activePage && (
        <div
          onPointerDown={stopMixerEvent}
          onPointerMove={stopMixerEvent}
          onPointerUp={stopMixerEvent}
          onPointerCancel={stopMixerEvent}
          onClick={stopMixerEvent}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            padding: 24,
            background: "rgba(4, 6, 14, 0.48)",
            backdropFilter: "blur(14px)",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            maxHeight: "100vh",
          }}
        >
          <div
            onPointerDown={stopMixerEvent}
            style={{
              width: "min(960px, 100%)",
              margin: "0 auto",
              borderRadius: 28,
              border: "1px solid rgba(255,255,255,0.12)",
              background:
                "linear-gradient(180deg, rgba(14, 20, 38, 0.92), rgba(9, 14, 28, 0.92))",
              boxShadow: "0 32px 60px rgba(0,0,0,0.35)",
              padding: 28,
              display: "grid",
              gap: 24,
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(182, 208, 255, 0.74)",
                  }}
                >
                  Mixer pages
                </div>
                <h2
                  style={{
                    margin: "10px 0 6px",
                    fontSize: "clamp(28px, 4vw, 42px)",
                    color: "white",
                  }}
                >
                  {activePage.title}
                </h2>
                <p
                  style={{
                    margin: 0,
                    maxWidth: 540,
                    lineHeight: 1.5,
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  {activePage.blurb}
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onPointerDown={stopMixerEvent}
                  onPointerUp={stopMixerEvent}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMixerOpen(false);
                  }}
                  aria-label="Back to sky mode"
                  style={{
                    padding: "12px 18px",
                    borderRadius: 14,
                    border: "1px solid rgba(172, 210, 255, 0.5)",
                    background: "rgba(122, 170, 255, 0.24)",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                    minHeight: 44,
                  }}
                >
                  ← Back to Sky
                </button>
                {initialMixerPages.map((page) => {
                  const isActive = page.id === activePage.id;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onPointerDown={stopMixerEvent}
                      onPointerUp={stopMixerEvent}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePageId(page.id);
                      }}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 14,
                        border: isActive
                          ? "1px solid rgba(140,200,255,0.45)"
                          : "1px solid rgba(255,255,255,0.10)",
                        background: isActive ? "rgba(120, 168, 255, 0.2)" : "rgba(255,255,255,0.04)",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      {page.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 18,
                alignItems: "end",
              }}
            >
              {activePage.channels.map((channel) => (
                <div
                  key={channel.id}
                  style={{
                    padding: 18,
                    borderRadius: 22,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)",
                    minHeight: 320,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "rgba(177, 206, 255, 0.76)",
                      }}
                    >
                      Channel
                    </div>
                    <div style={{ marginTop: 10, fontSize: 22, color: "white", fontWeight: 600 }}>
                      {channel.name}
                    </div>
                    <div style={{ marginTop: 8, color: "rgba(255,255,255,0.68)", lineHeight: 1.45 }}>
                      {channel.detail}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      color: "rgba(255,255,255,0.82)",
                    }}
                  >
                    <span>Level</span>
                    <strong>{channelDisplayPercent(channel.id)}%</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", lineHeight: 1.35 }}>
                    {channelStatusText(channel.id)}
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={200}
                    value={mixLevels[channel.id] ?? 100}
                    onPointerDown={stopMixerEvent}
                    onPointerUp={stopMixerEvent}
                    onClick={stopMixerEvent}
                    onChange={(e) =>
                      updateChannelLevel(channel.id, Number(e.currentTarget.value))
                    }
                    aria-label={`${channel.name} level`}
                    style={{ writingMode: "vertical-lr", width: "100%", height: 160 }}
                  />

                  <div
                    style={{
                      marginTop: "auto",
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${channelDisplayPercent(channel.id)}%`,
                        height: "100%",
                        background:
                          "linear-gradient(90deg, rgba(120, 176, 255, 0.85), rgba(182, 214, 255, 0.95))",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {shouldShowSplash && (
        <div style={{ position: "absolute", inset: 0, zIndex: 8 }}>
          <SplashIntro onComplete={() => setHasCompletedSplash(true)} sky={sky} />
        </div>
      )}

      {overlayVisible && !mixerOpen && !shouldShowSplash && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.15)",
            backdropFilter: "blur(2px)",
            pointerEvents: "auto",
            zIndex: 4,
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: 18,
              borderRadius: 18,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.9)",
              width: "min(360px, 86vw)",
            }}
          >
            <div style={{ letterSpacing: "0.18em", fontSize: 12, opacity: 0.8 }}>
              SKY MODE
            </div>
            <div style={{ fontSize: 20, marginTop: 10, fontWeight: 600 }}>
              Place tuning ritual
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>
              Location initializes on open. Press the center resonance to tune this place.
            </div>
            <button
              type="button"
              onPointerDown={stopMixerEvent}
              onClick={() => {
                if (hasUnlockedAudio) return;
                setHasUnlockedAudio(true);
                void unlockAndFadeIn();
              }}
              aria-label="Tune place resonance"
              style={{
                width: 132,
                height: 132,
                marginTop: 18,
                borderRadius: 999,
                border: "1px solid rgba(160, 208, 255, 0.74)",
                background:
                  "radial-gradient(circle at 50% 50%, rgba(194, 229, 255, 0.82), rgba(84, 146, 255, 0.36) 56%, rgba(57, 101, 190, 0.2) 100%)",
                color: "rgba(245, 251, 255, 0.97)",
                boxShadow: "0 0 0 1px rgba(196, 224, 255, 0.5), 0 0 36px rgba(118, 176, 255, 0.42)",
                cursor: "pointer",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontSize: 12,
              }}
            >
              Resonance
            </button>
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
              Drag after tuning to modulate filter motion while the drone stays continuous.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
