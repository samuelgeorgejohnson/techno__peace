import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CelestialMixerState, CelestialSignals } from "@technopeace/codex-data/types/CelestialSignals";
import type { AirSignal, ManMadeMixerState } from "@technopeace/codex-data/types/ManMadeSignals";
import type { AudioEngineSignalPayload, ChaosLaneId, ChaosPattern } from "@technopeace/codex-data/types/SignalPayload";
import { derivePlaceBaseFrequency, useAudioEngine } from "../hooks/useAudioEngine";
import type { AudioMonitorState } from "../hooks/useAudioEngine";
import { useCurrentWeatherSignal } from "../hooks/useCurrentWeatherSignal";
import { useManMadeAirSignal } from "../hooks/useManMadeAirSignal";
import { getClockSkyFallback, getSkyState } from "./getSkyState";
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
type ActiveTouch = Pt & { pointerId: number; startedAt: number; voiceId: number };

const CHAOS_STEPS = 16;
const CHAOS_LANES: Array<{ id: ChaosLaneId; label: string }> = [
  { id: "kick", label: "Kick" },
  { id: "bass", label: "Bass" },
  { id: "hat", label: "Hat" },
];

function makeDefaultChaosPattern(): ChaosPattern {
  return {
    kick: Array.from({ length: CHAOS_STEPS }, (_, i) => ({ on: i % 4 === 0, accent: i % 8 === 0 })),
    bass: Array.from({ length: CHAOS_STEPS }, (_, i) => ({ on: i % 8 === 0 || i % 8 === 5, accent: i % 8 === 0 })),
    hat: Array.from({ length: CHAOS_STEPS }, (_, i) => ({ on: i % 2 === 0, accent: i % 4 === 2 })),
  };
}
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
      { id: "placeDrone", name: "Place Drone", detail: "Base drone level and place resonance" },
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
  placeDrone: 100,
  birds: 100,
  chimes: 100,
  train: 100,
  traffic: 100,
  air: 100,
  harbor: 100,
};

const AUDIO_MONITOR_LAYERS: Array<{ id: keyof AudioMonitorState; label: string }> = [
  { id: "baseDrone", label: "Base drone" },
  { id: "wind", label: "Wind" },
  { id: "rain", label: "Rain" },
  { id: "birds", label: "Birds" },
  { id: "chimes", label: "Chimes" },
  { id: "air", label: "Air" },
  { id: "traffic", label: "Traffic" },
];
const AUDIO_MONITOR_LABELS: Record<keyof AudioMonitorState, string> = AUDIO_MONITOR_LAYERS.reduce(
  (acc, layer) => ({ ...acc, [layer.id]: layer.label.toLowerCase() }),
  {} as Record<keyof AudioMonitorState, string>,
);

const DEFAULT_AUDIO_MONITOR_STATE: AudioMonitorState = {
  baseDrone: true,
  wind: true,
  rain: true,
  birds: true,
  chimes: true,
  air: true,
  traffic: true,
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
  const { start, update, isRunning, setAudioMonitorState } = useAudioEngine();
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
  const [performanceMode, setPerformanceMode] = useState<"sky" | "chaos">("sky");
  const [chaosTempoBpm, setChaosTempoBpm] = useState(100);
  const [audioMonitor, setAudioMonitor] = useState<AudioMonitorState>(DEFAULT_AUDIO_MONITOR_STATE);
  const [chaosVizStep, setChaosVizStep] = useState(0);
  const [chaosPattern, setChaosPattern] = useState<ChaosPattern>(() => makeDefaultChaosPattern());
  const [pulseLock, setPulseLock] = useState(true);
  const [holdChaos, setHoldChaos] = useState(false);
  const [skyHold, setSkyHold] = useState(false);
  const [activeTouches, setActiveTouches] = useState<Record<number, ActiveTouch>>({});
  const [heldSkyVoices, setHeldSkyVoices] = useState<Pt[]>([]);
  const nextVoiceIdRef = useRef(1);
  const latestPointRef = useRef(pt);
  const manMadeAir = useManMadeAirSignal(weather.latitude, weather.longitude);

  const overlayVisible = useMemo(() => !hasUnlockedAudio, [hasUnlockedAudio]);
  const dronePressure = 0.58;
  const activePage = useMemo(
    () => initialMixerPages.find((page) => page.id === activePageId) ?? initialMixerPages[0],
    [activePageId],
  );
  const rawWind = clamp01(weather.windMps / 20);
  const currentRainComponentsMm = weather.rainMm + weather.showersMm;
  const activePrecipitationMm = Math.max(currentRainComponentsMm, weather.precipitationMm);
  const hasActivePrecipitation = activePrecipitationMm > 0;
  const rawRain = clamp01(activePrecipitationMm / 5);
  const rawHumidity = clamp01(weather.humidityPct / 100);
  const windMix = (mixLevels.wind ?? 100) / 100;
  const rainMix = (mixLevels.rain ?? 100) / 100;
  const humidityMix = (mixLevels.humidity ?? 100) / 100;
  const sunMix = (mixLevels.sun ?? 100) / 100;
  const moonMix = (mixLevels.moon ?? 100) / 100;
  const placeDroneMix = (mixLevels.placeDrone ?? 100) / 100;
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
  const splashSky = useMemo(() => {
    if (weather.status === "live") return sky;
    const clockSky = getClockSkyFallback();
    return getSkyState({
      sunAltitudeDeg: clockSky.sunAltitudeDeg,
      isDay: clockSky.isDay,
      cloudCover: weather.cloudCover,
      windMps: weather.windMps,
      moonIllumination,
    });
  }, [moonIllumination, sky, weather.cloudCover, weather.status, weather.windMps]);
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
  const roadSourceStatus: DiagnosticSourceStatus =
    manMadeAir.roadStatus === "live"
      ? "live"
      : manMadeAir.roadStatus === "unavailable"
        ? "unavailable"
        : "fallback";
  const trafficReliable = manMadeAir.roadStatus === "live" && Boolean(manMadeAir.road);

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
        note: "raw weather wind Ã