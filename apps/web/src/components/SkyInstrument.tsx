import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CelestialMixerState, CelestialSignals } from "@technopeace/codex-data/types/CelestialSignals";
import type { ManMadeMixerState } from "@technopeace/codex-data/types/ManMadeSignals";
import type { AudioEngineSignalPayload } from "@technopeace/codex-data/types/SignalPayload";
import { derivePlaceBaseFrequency, useAudioEngine } from "../hooks/useAudioEngine";
import { useCurrentWeatherSignal } from "../hooks/useCurrentWeatherSignal";
import { getSkyState } from "./getSkyState";
import SplashIntro from "./SplashIntro";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

type Pt = { x: number; y: number; pressure: number };
type Channel = { id: string; name: string; detail: string };
type MixerPage = { id: string; title: string; blurb: string; channels: Channel[] };

const initialMixerPages: MixerPage[] = [
  {
    id: "weather",
    title: "Weather channels",
    blurb: "Blend the sky's natural voices into the instrument.",
    channels: [
      { id: "rain", name: "Rain", detail: "Soft roof hiss and droplets" },
      { id: "wind", name: "Wind", detail: "Wide gusts and airy movement" },
      { id: "humidity", name: "Humidity", detail: "Diffusion and wet air softness" },
    ],
  },
  {
    id: "celestial",
    title: "Celestial channels",
    blurb: "Balance sunlight and moonlight motion against the weather bed.",
    channels: [
      { id: "sun", name: "Sun", detail: "Daylight tone movement and warmth" },
      { id: "moon", name: "Moon", detail: "Lunar modulation and night drift" },
    ],
  },
  {
    id: "man-made",
    title: "Man-made channels",
    blurb: "Shape the urban and mechanical layers around the weather bed.",
    channels: [
      { id: "train", name: "Train", detail: "Steel rhythm and rail hum" },
      { id: "traffic", name: "Traffic", detail: "Passing tires and city motion" },
      { id: "factory", name: "Factory", detail: "Machine drones and clanks" },
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
  train: 100,
  traffic: 100,
  factory: 100,
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
  const celestialMix: CelestialMixerState = useMemo(
    () => ({ sun: sunMix, moon: moonMix }),
    [moonMix, sunMix],
  );
  const manMadeMix: ManMadeMixerState = useMemo(
    () => ({
      road: (mixLevels.traffic ?? 100) / 100,
      subway: (mixLevels.train ?? 100) / 100,
      air: (mixLevels.factory ?? 100) / 100,
      bus: (mixLevels.harbor ?? 100) / 100,
    }),
    [mixLevels.factory, mixLevels.harbor, mixLevels.traffic, mixLevels.train],
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
          motion: sunMix,
          brightness: weather.isDay ? 1 : 0.18,
          spatialBias: 0,
          modulationDepth: sunMix,
          tension: clamp01(1 - weather.cloudCover),
        },
      },
      moon: {
        altitudeDeg: -weather.sunAltitudeDeg,
        azimuthDeg: 0,
        phase: weather.moonPhase,
        visible: !weather.isDay,
        illumination: weather.moonPhase <= 0.5 ? weather.moonPhase * 2 : (1 - weather.moonPhase) * 2,
        normalized: {
          presence: clamp01((90 - weather.sunAltitudeDeg) / 180),
          motion: moonMix,
          brightness: clamp01(1 - weather.sunAltitudeDeg / 120),
          spatialBias: 0,
          modulationDepth: moonMix,
          tension: clamp01(weather.moonPhase <= 0.5 ? weather.moonPhase * 2 : (1 - weather.moonPhase) * 2),
        },
      },
    }),
    [moonMix, sunMix, weather.cloudCover, weather.isDay, weather.moonPhase, weather.sunAltitudeDeg],
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
      }),
    [weather.cloudCover, weather.isDay, weather.sunAltitudeDeg, weather.windMps],
  );
  const nightness = 1 - sky.dayness;
  const cloudAlpha = 0.06 + sky.dayness * 0.18;
  const cloudAlphaDense = 0.18 + sky.dayness * 0.38;

  const shouldShowSplash =
    !hasCompletedSplash &&
    (weather.status === "live" || weather.status === "fallback" || weather.status === "error");

  function audioParams(nextPt: Pt): AudioEngineSignalPayload {
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
      sunLevel: celestialMix.sun ?? 1,
      moonLevel: celestialMix.moon ?? 1,
    };
  }

  useEffect(() => {
    if (!isRunning) return;
    update(audioParams(pt));
  }, [celestialMix.moon, celestialMix.sun, effectiveHumidity, effectiveRain, effectiveWind, isRunning, pt, update, weather.altitudeM, weather.cloudCover, weather.dailyRainMm, weather.isDay, weather.latitude, weather.longitude, weather.moonPhase, weather.precipitationMm, weather.sunAltitudeDeg, weather.temperatureC]);

  useEffect(
    () => () => {
      if (fadeFrameRef.current !== null) {
        cancelAnimationFrame(fadeFrameRef.current);
      }
    },
    [],
  );

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
    if (mixerOpen || !hasUnlockedAudio) return;

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const { x, y } = getXY(e);
    const pressure = clamp01(Math.max(dronePressure, e.pressure || dronePressure));

    setIsDragging(true);
    setPt({ x, y, pressure });
    update(audioParams({ x, y, pressure }));
  }

  function onPointerMove(e: React.PointerEvent) {
    if (mixerOpen || !hasUnlockedAudio || !isDragging || e.buttons === 0) return;
    const { x, y } = getXY(e);
    const pressure = clamp01(Math.max(dronePressure, e.pressure || dronePressure));

    setPt({ x, y, pressure });
    update(audioParams({ x, y, pressure }));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (mixerOpen || !hasUnlockedAudio) return;
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

  function stopMixerEvent(e: React.PointerEvent | React.MouseEvent) {
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
    return mixLevels[channelId] ?? 100;
  }

  function channelStatusText(channelId: string) {
    if (channelId === "sun") {
      if (weather.isDay) {
        return `Live: day • altitude ${weather.sunAltitudeDeg.toFixed(0)}°`;
      }
      return `Live: below horizon ${Math.abs(weather.sunAltitudeDeg).toFixed(0)}°`;
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
      return `${weather.isDay ? "Day sky" : "Night sky"} • ${phaseLabel}`;
    }
    return "Live: linked to current place signal";
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
        touchAction: mixerOpen ? "auto" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        background: `linear-gradient(180deg, ${sky.topColor} 0%, ${sky.midColor} 54%, ${sky.horizonColor} 100%)`,
        filter: `brightness(${0.34 + sky.brightness * 0.72}) saturate(${0.68 + sky.dayness * 0.4}) contrast(${0.95 + nightness * 0.16})`,
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
          inset: "-8%",
          pointerEvents: "none",
          background: "radial-gradient(1200px 740px at 50% 52%, rgba(0, 0, 0, 0), rgba(0, 4, 16, 0.55) 72%, rgba(0, 0, 0, 0.86) 100%)",
          opacity: nightness * 0.72,
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
          background: `radial-gradient(940px 620px at 50% 64%, rgba(255, 255, 255, ${0.02 + weather.moonPhase * 0.24}), rgba(255, 255, 255, 0) 74%)`,
          opacity: nightness * (0.4 + weather.moonPhase * 0.9),
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
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 3,
          padding: 12,
          borderRadius: 14,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.9)",
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          backdropFilter: "blur(10px)",
          display: "grid",
          gap: 8,
          minWidth: 220,
        }}
      >
        <div style={{ letterSpacing: "0.06em", fontWeight: 700 }}>GEOLOCATION + MIXER</div>
        <button
          type="button"
          onPointerDown={stopMixerEvent}
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
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Mixer
          </span>
        </button>
        <div style={{ opacity: 0.9 }}>{locationText}</div>
        <button
          type="button"
          onPointerDown={stopMixerEvent}
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
        <div>F₀ base: {placeBaseHz.toFixed(1)} Hz</div>
        <div>tonic now: {currentTonicHz.toFixed(1)} Hz</div>
        <div>wind raw/effective: {Math.round(rawWind * 100)}% / {Math.round(effectiveWind * 100)}%</div>
        <div>rain raw/effective: {Math.round(rawRain * 100)}% / {Math.round(effectiveRain * 100)}%</div>
        <div>
          humidity raw/effective: {Math.round(rawHumidity * 100)}% / {Math.round(effectiveHumidity * 100)}%
        </div>
        <div>celestial: sun {Math.round((celestialSignals.sun?.normalized.motion ?? 1) * 100)}% moon {Math.round((celestialSignals.moon?.normalized.motion ?? 1) * 100)}%</div>
        <div>man-made: road {Math.round((manMadeMix.road ?? 1) * 100)}% subway {Math.round((manMadeMix.subway ?? 1) * 100)}%</div>
      </div>

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
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
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
                {initialMixerPages.map((page) => {
                  const isActive = page.id === activePage.id;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onPointerDown={stopMixerEvent}
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
