import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useLocation } from "@technopeace/codex-map/useLocation";

type Pt = { x: number; y: number; pressure: number };
type Ripple = { id: string; x: number; y: number; size: number; strength: number };

type SkyConditions = {
  cloudCover: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  isDay: boolean;
  temperature: number;
  loading: boolean;
  error: string | null;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: [number, number, number], b: [number, number, number], t: number) =>
  a.map((channel, index) => Math.round(lerp(channel, b[index], t))) as [number, number, number];
const rgb = (color: [number, number, number], alpha = 1) =>
  `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;

const DEFAULT_CONDITIONS: SkyConditions = {
  cloudCover: 0.28,
  windSpeed: 3,
  windDirection: 35,
  weatherCode: 1,
  isDay: true,
  temperature: 21,
  loading: true,
  error: null,
};

function weatherMood(weatherCode: number) {
  if (weatherCode >= 95) return "storm";
  if (weatherCode >= 80) return "rain";
  if (weatherCode >= 71) return "snow";
  if (weatherCode >= 51) return "mist";
  if (weatherCode >= 45) return "fog";
  if (weatherCode >= 3) return "cloudy";
  return "clear";
}

function useSkyConditions() {
  const { location, error: locationError } = useLocation();
  const [conditions, setConditions] = useState<SkyConditions>(DEFAULT_CONDITIONS);

  useEffect(() => {
    const controller = new AbortController();
    const { lat, lon } = location;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return () => controller.abort();
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toFixed(4));
    url.searchParams.set("longitude", lon.toFixed(4));
    url.searchParams.set(
      "current",
      [
        "temperature_2m",
        "cloud_cover",
        "wind_speed_10m",
        "wind_direction_10m",
        "weather_code",
        "is_day",
      ].join(",")
    );
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "1");

    fetch(url.toString(), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`weather-${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        const current = data.current ?? {};
        setConditions({
          cloudCover: clamp01((current.cloud_cover ?? DEFAULT_CONDITIONS.cloudCover * 100) / 100),
          windSpeed: Math.max(0, current.wind_speed_10m ?? DEFAULT_CONDITIONS.windSpeed),
          windDirection: clamp(current.wind_direction_10m ?? DEFAULT_CONDITIONS.windDirection, 0, 360),
          weatherCode: current.weather_code ?? DEFAULT_CONDITIONS.weatherCode,
          isDay: Boolean(current.is_day ?? DEFAULT_CONDITIONS.isDay),
          temperature: current.temperature_2m ?? DEFAULT_CONDITIONS.temperature,
          loading: false,
          error: null,
        });
      })
      .catch((fetchError: Error) => {
        if (fetchError.name === "AbortError") return;
        setConditions((current) => ({
          ...current,
          loading: false,
          error: fetchError.message,
        }));
      });

    return () => controller.abort();
  }, [location.lat, location.lon]);

  useEffect(() => {
    if (!locationError) return;
    setConditions((current) => ({ ...current, error: locationError, loading: false }));
  }, [locationError]);

  return { conditions, locationError };
}

function buildSkyPalette(hour: number, conditions: SkyConditions) {
  const daylight = conditions.isDay ? Math.max(0, Math.sin((hour / 24) * Math.PI)) : 0;
  const dawnness = Math.exp(-Math.pow((hour - 6) / 2.2, 2));
  const duskness = Math.exp(-Math.pow((hour - 18) / 2.4, 2));
  const twilight = clamp01(dawnness + duskness);
  const cloud = clamp01(conditions.cloudCover);
  const mood = weatherMood(conditions.weatherCode);

  let zenith: [number, number, number] = conditions.isDay ? [65, 120, 220] : [8, 15, 34];
  let horizon: [number, number, number] = conditions.isDay ? [168, 214, 255] : [28, 36, 74];
  let glow: [number, number, number] = conditions.isDay ? [255, 224, 170] : [130, 160, 255];

  zenith = mixRgb([18, 24, 48], zenith, daylight);
  horizon = mixRgb([42, 49, 83], horizon, daylight);

  if (twilight > 0.05) {
    zenith = mixRgb(zenith, [126, 91, 160], twilight * 0.55);
    horizon = mixRgb(horizon, [255, 166, 116], twilight * 0.9);
    glow = mixRgb(glow, [255, 150, 112], twilight * 0.85);
  }

  zenith = mixRgb(zenith, [104, 112, 128], cloud * 0.7);
  horizon = mixRgb(horizon, [188, 192, 205], cloud * 0.55);

  if (mood === "rain" || mood === "storm") {
    zenith = mixRgb(zenith, [42, 54, 72], 0.75);
    horizon = mixRgb(horizon, [96, 110, 128], 0.7);
    glow = mixRgb(glow, [181, 210, 255], 0.45);
  } else if (mood === "fog" || mood === "mist") {
    zenith = mixRgb(zenith, [123, 134, 148], 0.55);
    horizon = mixRgb(horizon, [208, 214, 224], 0.65);
  } else if (mood === "snow") {
    zenith = mixRgb(zenith, [142, 162, 190], 0.5);
    horizon = mixRgb(horizon, [232, 238, 245], 0.7);
  }

  return { daylight, twilight, cloud, mood, zenith, horizon, glow };
}

export default function SkyInstrument() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const dragActiveRef = useRef(false);
  const rippleCounter = useRef(0);
  const lastRippleAt = useRef(0);
  const { start, update, isRunning } = useAudioEngine();
  const { conditions, locationError } = useSkyConditions();

  const [pt, setPt] = useState<Pt>({ x: 0.5, y: 0.5, pressure: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [windPhase, setWindPhase] = useState(0);

  useEffect(() => {
    let frame = 0;
    let previous = performance.now();

    const animate = (now: number) => {
      const delta = now - previous;
      previous = now;
      setWindPhase((phase) => phase + delta * (0.0007 + conditions.windSpeed * 0.00016));
      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [conditions.windSpeed]);

  const overlayVisible = useMemo(() => !hasInteracted, [hasInteracted]);

  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const palette = useMemo(
    () => buildSkyPalette(hour, conditions),
    [hour, conditions.cloudCover, conditions.isDay, conditions.weatherCode]
  );

  const windRadians = ((conditions.windDirection - 90) * Math.PI) / 180;
  const windVector = {
    x: Math.cos(windRadians),
    y: Math.sin(windRadians),
  };
  const windTravel = 14 + conditions.windSpeed * 3.4;
  const shimmerShiftX = Math.sin(windPhase) * windTravel * windVector.x;
  const shimmerShiftY = Math.sin(windPhase) * windTravel * windVector.y;
  const cloudShiftX = windPhase * 28 * windVector.x;
  const cloudShiftY = windPhase * 18 * windVector.y;

  const infoLabel = useMemo(() => {
    if (conditions.loading) return "calibrating live sky";
    if (conditions.error || locationError) return "using ambient fallback";
    return `${Math.round(conditions.temperature)}° • ${weatherMood(conditions.weatherCode)}`;
  }, [conditions.error, conditions.loading, conditions.temperature, conditions.weatherCode, locationError]);

  function createRipple(x: number, y: number, pressure: number) {
    const nowMs = performance.now();
    if (nowMs - lastRippleAt.current < 34) return;
    lastRippleAt.current = nowMs;

    const ripple: Ripple = {
      id: `${nowMs}-${rippleCounter.current++}`,
      x,
      y,
      size: 160 + pressure * 220,
      strength: 0.35 + pressure * 0.65,
    };

    setRipples((current) => [...current.slice(-10), ripple]);
    window.setTimeout(() => {
      setRipples((current) => current.filter((entry) => entry.id !== ripple.id));
    }, 1900);
  }

  function getXY(e: React.PointerEvent) {
    const el = elRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const r = el.getBoundingClientRect();
    const x = clamp01((e.clientX - r.left) / r.width);
    const y = clamp01((e.clientY - r.top) / r.height);
    return { x, y };
  }

  async function onPointerDown(e: React.PointerEvent) {
    dragActiveRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const { x, y } = getXY(e);
    const pressure = clamp01((e.pressure || 0.5) * 1.0);

    setHasInteracted(true);
    setPt({ x, y, pressure });
    createRipple(x, y, pressure);

    await start();
    update({ x, y, pressure });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragActiveRef.current) return;
    const { x, y } = getXY(e);
    const pressure = clamp01((e.pressure || 0.5) * 1.0);

    setPt({ x, y, pressure });
    createRipple(x, y, pressure);
    update({ x, y, pressure });
  }

  function onPointerUp(e: React.PointerEvent) {
    dragActiveRef.current = false;
    const { x, y } = getXY(e);
    setPt((p) => ({ ...p, x, y, pressure: 0 }));
    update({ x, y, pressure: 0 });
  }

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        background: [
          `radial-gradient(1000px 540px at 50% ${18 + palette.daylight * 22}%, ${rgb(palette.glow, 0.28 + palette.twilight * 0.26)}, transparent 58%)`,
          `linear-gradient(180deg, ${rgb(palette.zenith)} 0%, ${rgb(mixRgb(palette.zenith, palette.horizon, 0.4))} 40%, ${rgb(palette.horizon)} 100%)`,
        ].join(","),
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "-15%",
          opacity: 0.9,
          background: [
            `radial-gradient(34% 18% at ${50 + cloudShiftX * 0.1}% ${28 + cloudShiftY * 0.08}%, rgba(255,255,255,${0.16 + palette.cloud * 0.22}), transparent 72%)`,
            `radial-gradient(30% 14% at ${22 + cloudShiftX * 0.08}% ${24 + cloudShiftY * 0.06}%, rgba(255,255,255,${0.1 + palette.cloud * 0.16}), transparent 74%)`,
            `radial-gradient(28% 16% at ${76 + cloudShiftX * 0.11}% ${34 + cloudShiftY * 0.07}%, rgba(255,255,255,${0.12 + palette.cloud * 0.18}), transparent 72%)`,
          ].join(","),
          filter: `blur(${18 + palette.cloud * 16}px)`,
          transform: `translate(${cloudShiftX}px, ${cloudShiftY}px) scale(1.08)`,
          transition: "filter 600ms ease, opacity 600ms ease",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: "-20%",
          opacity: 0.34 + Math.min(conditions.windSpeed / 25, 0.2),
          backgroundImage: [
            `linear-gradient(${conditions.windDirection}deg, transparent 0%, rgba(255,255,255,0.06) 38%, rgba(255,255,255,0.18) 50%, transparent 66%)`,
            `linear-gradient(${conditions.windDirection}deg, transparent 0%, rgba(140,190,255,0.08) 44%, transparent 74%)`,
          ].join(","),
          backgroundSize: `${220 - conditions.windSpeed * 6}px ${220 - conditions.windSpeed * 6}px`,
          transform: `translate(${shimmerShiftX}px, ${shimmerShiftY}px) scale(1.1)`,
          mixBlendMode: "screen",
          filter: "blur(8px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: [
            "linear-gradient(180deg, rgba(255,255,255,0.1), transparent 28%)",
            `radial-gradient(120% 80% at 50% 100%, rgba(110, 170, 255, ${0.18 + palette.daylight * 0.1}), rgba(10, 12, 20, 0.08) 60%, rgba(8,10,18,0.36) 100%)`,
          ].join(","),
          pointerEvents: "none",
        }}
      />

      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          style={{
            position: "absolute",
            left: `calc(${ripple.x * 100}% - ${ripple.size / 2}px)`,
            top: `calc(${ripple.y * 100}% - ${ripple.size / 2}px)`,
            width: ripple.size,
            height: ripple.size,
            borderRadius: "50%",
            border: `1px solid rgba(220, 240, 255, ${0.4 * ripple.strength})`,
            boxShadow: `0 0 0 1px rgba(255,255,255,${0.2 * ripple.strength}) inset, 0 0 40px rgba(125, 190, 255, ${0.22 * ripple.strength})`,
            background: `radial-gradient(circle, rgba(200,235,255,${0.16 * ripple.strength}) 0%, rgba(200,235,255,${0.08 * ripple.strength}) 24%, rgba(255,255,255,0) 62%)`,
            transform: "scale(0.1)",
            opacity: 0.95,
            animation: "skyRipple 1.9s ease-out forwards",
            pointerEvents: "none",
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: `calc(${pt.x * 100}% - 34px)`,
          top: `calc(${pt.y * 100}% - 34px)`,
          width: 68,
          height: 68,
          borderRadius: 999,
          background: `radial-gradient(circle, rgba(210, 239, 255, 0.9) 0%, rgba(180, 220, 255, 0.28) 32%, rgba(180,220,255,0) 72%)`,
          boxShadow: "0 0 60px rgba(140,200,255,0.3)",
          transform: `scale(${0.8 + pt.pressure * 1.3})`,
          transition: "transform 40ms linear, left 45ms linear, top 45ms linear",
          pointerEvents: "none",
          opacity: 0.8,
          mixBlendMode: "screen",
        }}
      />

      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          padding: "12px 14px",
          borderRadius: 16,
          background: "rgba(4, 8, 18, 0.28)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.9)",
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          backdropFilter: "blur(14px)",
          pointerEvents: "none",
          minWidth: 192,
        }}
      >
        <div>audio: {isRunning ? "on" : "off"}</div>
        <div>sky: {infoLabel}</div>
        <div>
          wind: {Math.round(conditions.windSpeed)} m/s @ {Math.round(conditions.windDirection)}°
        </div>
        <div>
          x: {pt.x.toFixed(2)} y: {pt.y.toFixed(2)} pressure: {pt.pressure.toFixed(2)}
        </div>
      </div>

      {overlayVisible && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.1)",
            backdropFilter: "blur(2px)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: 18,
              borderRadius: 18,
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.92)",
              width: "min(380px, 86vw)",
            }}
          >
            <div style={{ letterSpacing: "0.18em", fontSize: 12, opacity: 0.8 }}>
              SKY MODE
            </div>
            <div style={{ fontSize: 20, marginTop: 10, fontWeight: 600 }}>
              Touch the sky and drag the weather
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
              The color now follows local time and live weather. Every touch throws water-like ripples
              across the sky while wind bands drift in the real wind direction.
            </div>
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.72 }}>(Tap to begin)</div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes skyRipple {
            0% {
              transform: scale(0.1);
              opacity: 0.92;
            }
            72% {
              opacity: 0.38;
            }
            100% {
              transform: scale(1.45);
              opacity: 0;
            }
          }
        `}
      </style>
    </div>
  );
}
