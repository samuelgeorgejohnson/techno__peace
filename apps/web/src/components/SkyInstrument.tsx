import React, { useRef, useState } from "react";
import { useAudioEngine } from "../hooks/useAudioEngine";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

type Pt = { x: number; y: number; pressure: number };

export default function SkyInstrument() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const { start, update, isRunning } = useAudioEngine();

  const [pt, setPt] = useState<Pt>({ x: 0.5, y: 0.5, pressure: 0 });

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
        minHeight: "100dvh",
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
          background:
            "radial-gradient(500px 500px at 50% 50%, rgba(130, 180, 255, 0.06), transparent 70%)",
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
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
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
      </div>
    </div>
  );
}
