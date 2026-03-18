import React, { useMemo, useRef, useState } from "react";
import type { MixerParams } from "../audio/audioEngine";
import MixerOverlay from "./MixerOverlay";
import { useAudioEngine } from "../hooks/useAudioEngine";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

type Pt = { x: number; y: number; pressure: number };

function MixerGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 5H16M4 10H16M4 15H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="5" r="2" fill="currentColor" />
      <circle cx="12" cy="10" r="2" fill="currentColor" />
      <circle cx="9" cy="15" r="2" fill="currentColor" />
    </svg>
  );
}

export default function SkyInstrument() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const { start, update, updateMixer, getMixer, isRunning } = useAudioEngine();

  const [pt, setPt] = useState<Pt>({ x: 0.5, y: 0.5, pressure: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [mixerValues, setMixerValues] = useState<MixerParams>(() => getMixer());

  const overlayVisible = useMemo(() => !hasInteracted, [hasInteracted]);

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
    setPt((p) => ({ ...p, x, y, pressure: 0 }));
    update({ x, y, pressure: 0 });
  }

  function handleMixerChange(name: keyof MixerParams, value: number) {
    setMixerValues((current) => {
      const next = { ...current, [name]: value };
      return next;
    });
    updateMixer({ [name]: value });
  }

  const orbScale = 1 + pt.pressure * 0.9 + mixerValues.shimmer * 0.25;

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
          "radial-gradient(1200px 700px at 30% 10%, rgba(170, 210, 255, 0.18), transparent 60%), radial-gradient(900px 600px at 72% 38%, rgba(122, 153, 255, 0.16), transparent 62%), radial-gradient(900px 900px at 50% 120%, rgba(70, 130, 220, 0.18), transparent 58%), linear-gradient(180deg, rgba(10,12,22,1) 0%, rgba(6,7,14,1) 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at ${pt.x * 100}% ${pt.y * 100}%, rgba(126, 195, 255, ${0.1 + pt.pressure * 0.18}), transparent 0%, transparent 26%)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `calc(${pt.x * 100}% - 28px)`,
          top: `calc(${pt.y * 100}% - 28px)`,
          width: 56,
          height: 56,
          borderRadius: 999,
          background: "rgba(186, 225, 255, 0.92)",
          boxShadow: `0 0 ${48 + mixerValues.shimmer * 40}px rgba(140, 200, 255, 0.42)`,
          transform: `scale(${orbScale})`,
          transition: "transform 40ms linear, box-shadow 180ms ease",
          pointerEvents: "none",
          opacity: 0.94,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 20,
          top: 20,
          padding: "14px 16px",
          borderRadius: 18,
          background: "rgba(4, 10, 24, 0.34)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(14px)",
          width: "min(380px, calc(100vw - 104px))",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.72 }}>Sky mode</div>
        <div style={{ marginTop: 8, fontSize: 28, lineHeight: 1, fontWeight: 700 }}>Weather instrument</div>
        <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, opacity: 0.82 }}>
          Keep dragging the field while the mixer floats above it. The pad never unmounts, so the sound keeps breathing underneath.
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMixerOpen(true)}
        aria-label="Open mixer"
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 20,
          width: 54,
          height: 54,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(80, 110, 180, 0.18)",
          backdropFilter: "blur(12px)",
          color: "white",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "0 10px 36px rgba(0,0,0,0.24)",
        }}
      >
        <MixerGlyph />
      </button>

      <div
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          padding: "12px 14px",
          borderRadius: 16,
          background: "rgba(0,0,0,0.32)",
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
        <div>wind/rain: {Math.round(mixerValues.wind * 100)}/{Math.round(mixerValues.rain * 100)}</div>
      </div>

      {overlayVisible && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.14)",
            backdropFilter: "blur(3px)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: 22,
              borderRadius: 22,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.9)",
              width: "min(380px, 88vw)",
            }}
          >
            <div style={{ letterSpacing: "0.18em", fontSize: 12, opacity: 0.8, textTransform: "uppercase" }}>Touch to begin</div>
            <div style={{ fontSize: 22, marginTop: 10, fontWeight: 600 }}>Tap and drag the sky.</div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
              First touch starts the engine. Open the top-right mixer any time to fade in layered wind, rain, shimmer, and pulse without leaving this screen.
            </div>
          </div>
        </div>
      )}

      <MixerOverlay
        open={mixerOpen}
        isRunning={isRunning}
        values={mixerValues}
        onChange={handleMixerChange}
        onClose={() => setMixerOpen(false)}
      />
    </div>
  );
}
