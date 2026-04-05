import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "../../../../packages/codex-map/src/useLocation";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useWeatherSignal } from "../hooks/useWeatherSignal";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

type Pt = { x: number; y: number; pressure: number };

function formatDegrees(value: number) {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value)}°`;
}

function describeLocationStatus(status: string, error: string | null) {
  if (status === "requesting") return "Requesting browser location permission...";
  if (status === "denied") return "Location access is blocked. Use the button below to try again after enabling it in the browser.";
  if (status === "unavailable") return "Geolocation is unavailable in this browser context.";
  if (error) return `Location status: ${error}.`;
  return "Waiting for precise location so weather and drone resonance match your place.";
}

export default function SkyInstrument() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const { start, update, isRunning } = useAudioEngine();
  const { location, error: locationError, status: locationStatus, requestLocation } = useLocation();
  const { weather, isLoading: weatherLoading, error: weatherError, droneSeed } = useWeatherSignal(location);

  const [pt, setPt] = useState<Pt>({ x: 0.5, y: 0.5, pressure: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);

  const overlayVisible = useMemo(() => !hasInteracted, [hasInteracted]);
  const shouldPromptLocation = locationStatus !== "granted";

  const audioFrame = useMemo(
    () => ({
      x: pt.x,
      y: pt.y,
      pressure: pt.pressure,
      precipitationMm: weather?.precipitationMm ?? 0,
      humidityPct: weather?.humidityPct ?? 55,
      windSpeedMps: weather?.windSpeedMps ?? 0,
      windDirectionDeg: weather?.windDirectionDeg ?? 0,
      temperatureC: weather?.temperatureC ?? 18,
      coordinatePhase: droneSeed.coordinatePhase,
      latInfluence: droneSeed.latInfluence,
      rotationPhase: droneSeed.rotationPhase,
    }),
    [droneSeed.coordinatePhase, droneSeed.latInfluence, droneSeed.rotationPhase, pt.pressure, pt.x, pt.y, weather]
  );

  useEffect(() => {
    if (!hasInteracted || !isRunning) return;
    update(audioFrame);
  }, [audioFrame, hasInteracted, isRunning, update]);

  function getXY(e: React.PointerEvent) {
    const el = elRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const r = el.getBoundingClientRect();
    const x = clamp01((e.clientX - r.left) / r.width);
    const y = clamp01((e.clientY - r.top) / r.height);
    return { x, y };
  }

  async function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    if (shouldPromptLocation) {
      requestLocation();
    }

    const { x, y } = getXY(e);
    const pressure = clamp01((e.pressure || 0.5) * 1.0);

    setHasInteracted(true);
    setPt({ x, y, pressure });

    await start();
    update({ ...audioFrame, x, y, pressure });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.buttons === 0) return;
    const { x, y } = getXY(e);
    const pressure = clamp01((e.pressure || 0.5) * 1.0);

    setPt({ x, y, pressure });
    update({ ...audioFrame, x, y, pressure });
  }

  function onPointerUp(e: React.PointerEvent) {
    const { x, y } = getXY(e);
    setPt((p) => ({ ...p, x, y, pressure: 0 }));
    update({ ...audioFrame, x, y, pressure: 0 });
  }

  function onLocationButtonClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    requestLocation();
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
        background:
          "radial-gradient(1200px 700px at 30% 10%, rgba(170, 210, 255, 0.16), transparent 60%), radial-gradient(900px 600px at 70% 40%, rgba(140, 160, 255, 0.14), transparent 62%), linear-gradient(180deg, rgba(10,12,22,1) 0%, rgba(6,7,14,1) 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at ${50 + (weather?.windDirectionDeg ?? 0) / 9}% ${22 + (weather?.humidityPct ?? 50) / 7}%, rgba(135, 173, 255, 0.14), transparent 28%), radial-gradient(circle at ${20 + (weather?.precipitationMm ?? 0) * 3}% 78%, rgba(125, 214, 255, ${0.08 + Math.min((weather?.precipitationMm ?? 0) / 15, 0.22)}), transparent 22%)`,
          pointerEvents: "none",
        }}
      />

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
          boxShadow: `0 0 ${40 + (weather?.humidityPct ?? 0) * 0.22}px rgba(140,200,255,0.35)`,
          transform: `scale(${1 + pt.pressure * 0.8})`,
          transition: "transform 40ms linear",
          pointerEvents: "none",
          opacity: 0.9,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          padding: "12px 14px",
          borderRadius: 16,
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.09)",
          color: "rgba(255,255,255,0.9)",
          width: "min(380px, calc(100vw - 32px))",
          backdropFilter: "blur(12px)",
          pointerEvents: "auto",
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: "0.18em", opacity: 0.74 }}>LOCATION RESONANCE</div>
        <div style={{ marginTop: 8, fontSize: 20, fontWeight: 600 }}>
          {location.placeName || `${location.lat.toFixed(3)}, ${location.lon.toFixed(3)}`}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.76 }}>
          Drone fundamental follows latitude/longitude plus diurnal rotation.
        </div>
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.72 }}>
          {describeLocationStatus(locationStatus, locationError)}
        </div>
        {shouldPromptLocation && (
          <button
            type="button"
            onClick={onLocationButtonClick}
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(116, 178, 255, 0.18)",
              color: "white",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {locationStatus === "requesting" ? "Requesting location..." : "Enable location"}
          </button>
        )}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, fontSize: 12 }}>
          <div>
            <div style={{ opacity: 0.65 }}>precipitation</div>
            <div>{weather ? `${weather.precipitationMm.toFixed(1)} mm → percussive rain hits` : "waiting..."}</div>
          </div>
          <div>
            <div style={{ opacity: 0.65 }}>humidity</div>
            <div>{weather ? `${weather.humidityPct.toFixed(0)}% → reverb depth` : "waiting..."}</div>
          </div>
          <div>
            <div style={{ opacity: 0.65 }}>wind</div>
            <div>
              {weather
                ? `${weather.windSpeedMps.toFixed(1)} m/s ${formatDegrees(weather.windDirectionDeg)} → pan + noise`
                : "waiting..."}
            </div>
          </div>
          <div>
            <div style={{ opacity: 0.65 }}>temperature</div>
            <div>{weather ? `${weather.temperatureC.toFixed(1)}°C → timbre` : "waiting..."}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.66 }}>
          {weatherLoading && "Loading weather for current location..."}
          {!weatherLoading && weather && `Sampled ${weather.sampleTime} (${weather.source}).`}
          {!weatherLoading && !weather && weatherError && `Weather unavailable: ${weatherError}.`}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          padding: "10px 12px",
          borderRadius: 14,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.86)",
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          backdropFilter: "blur(10px)",
          pointerEvents: "none",
        }}
      >
        <div>audio: {isRunning ? "on" : "off"}</div>
        <div>
          x: {pt.x.toFixed(2)} y: {pt.y.toFixed(2)}
        </div>
        <div>pressure: {pt.pressure.toFixed(2)}</div>
        <div>drone φ: {audioFrame.coordinatePhase.toFixed(2)}</div>
      </div>

      {overlayVisible && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.15)",
            backdropFilter: "blur(2px)",
            pointerEvents: "none",
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
              width: "min(420px, 88vw)",
            }}
          >
            <div style={{ letterSpacing: "0.18em", fontSize: 12, opacity: 0.8 }}>
              WEATHER SONIFICATION
            </div>
            <div style={{ fontSize: 20, marginTop: 10, fontWeight: 600 }}>Tap & drag anywhere</div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>
              Opening the page now requests location. If your browser suppresses the first prompt, tap once or use the
              location button to retry, then drag to play the weather-driven instrument.
            </div>
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>(First touch starts audio and keeps weather-reactive updates alive.)</div>
          </div>
        </div>
      )}
    </div>
  );
}
