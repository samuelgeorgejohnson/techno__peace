import React, { useEffect, useMemo, useRef, useState } from "react";
import DiagnosticsOverlay from "./DiagnosticsOverlay";
import MixerOverlay from "./MixerOverlay";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useWeatherDiagnostics } from "../hooks/useWeatherDiagnostics";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

type Pt = { x: number; y: number; pressure: number };

export default function SkyInstrument() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const { state, mapping, refreshWeather } = useWeatherDiagnostics();
  const { start, update, isRunning, debugState } = useAudioEngine(mapping);

  const [pt, setPt] = useState<Pt>({ x: 0.5, y: 0.5, pressure: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);

  const overlayVisible = useMemo(() => !hasInteracted, [hasInteracted]);

  useEffect(() => {
    update(pt);
  }, [mapping, pt, update]);

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

    const { x, y } = getXY(e);
    const pressure = clamp01((e.pressure || 0.5) * 1.0);

    setHasInteracted(true);
    setPt({ x, y, pressure });

    await start();
    update({ x, y, pressure });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.buttons === 0) return;
    const { x, y } = getXY(e);
    const pressure = clamp01((e.pressure || 0.5) * 1.0);

    setPt({ x, y, pressure });
    update({ x, y, pressure });
  }

  function onPointerUp(e: React.PointerEvent) {
    const { x, y } = getXY(e);
    const next = { x, y, pressure: 0 };
    setPt(next);
    update(next);
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
      <button
        onClick={(event) => {
          event.stopPropagation();
          setMixerOpen(true);
        }}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 20,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(8, 17, 30, 0.82)",
          color: "#dff6ff",
          borderRadius: 999,
          padding: "12px 16px",
          fontWeight: 800,
          letterSpacing: "0.12em",
          fontSize: 12,
          boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
        }}
      >
        MIXER
      </button>

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
          opacity: 0.9,
        }}
      />

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
        <div>weather: {state.weather.sourceStatus}</div>
        <div>
          channels: {debugState.weatherMapping.activeWeatherDrivenChannels} running / {Object.values(debugState.channelStatus).filter((value) => value === true).length} active
        </div>
        <div>
          x: {pt.x.toFixed(2)} y: {pt.y.toFixed(2)}
        </div>
        <div>pressure: {pt.pressure.toFixed(2)}</div>
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
              width: "min(360px, 86vw)",
            }}
          >
            <div style={{ letterSpacing: "0.18em", fontSize: 12, opacity: 0.8 }}>
              SKY MODE
            </div>
            <div style={{ fontSize: 20, marginTop: 10, fontWeight: 600 }}>
              Tap & drag anywhere
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>
              First touch starts audio. Move to shape tone and texture. Open MIXER for weather routing details and diagnostics.
            </div>
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
              (Tap to dismiss)
            </div>
          </div>
        </div>
      )}

      {mixerOpen && (
        <MixerOverlay
          mapping={mapping}
          channelStatus={debugState.channelStatus}
          onClose={() => setMixerOpen(false)}
          onOpenDiagnostics={() => setDiagnosticsOpen(true)}
        />
      )}

      {diagnosticsOpen && (
        <DiagnosticsOverlay
          diagnostics={state}
          mapping={mapping}
          channelStatus={debugState.channelStatus}
          isAudioRunning={isRunning}
          onClose={() => setDiagnosticsOpen(false)}
          onRefresh={() => {
            void refreshWeather();
          }}
        />
      )}
    </div>
  );
}
