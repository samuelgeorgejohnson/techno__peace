import React, { useMemo, useRef, useState } from "react";
import { useAudioEngine } from "../hooks/useAudioEngine";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

type Pt = { x: number; y: number; pressure: number };
type PointerPt = Pt & { id: number };

const CENTER_POINT: Pt = { x: 0.5, y: 0.5, pressure: 0.18 };

function averagePoints(points: PointerPt[]): Pt {
  if (points.length === 0) {
    return { ...CENTER_POINT, pressure: 0 };
  }

  const totals = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
      pressure: acc.pressure + point.pressure,
    }),
    { x: 0, y: 0, pressure: 0 },
  );

  return {
    x: totals.x / points.length,
    y: totals.y / points.length,
    pressure: clamp01(Math.max(totals.pressure / points.length, 0.14)),
  };
}

function calculateSpread(points: PointerPt[]) {
  if (points.length < 2) return 0;

  const centroid = averagePoints(points);
  const distance = points.reduce((sum, point) => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  return clamp01((distance / points.length) * 2.4);
}

export default function SkyInstrument() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef(new Map<number, PointerPt>());
  const { start, update, isRunning } = useAudioEngine();

  const [pt, setPt] = useState<Pt>(CENTER_POINT);
  const [touches, setTouches] = useState<PointerPt[]>([]);
  const [hasEntered, setHasEntered] = useState(false);

  const entryVisible = useMemo(() => !hasEntered, [hasEntered]);
  const activeTouchCount = touches.length;

  function getXY(e: React.PointerEvent) {
    const el = elRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const r = el.getBoundingClientRect();
    const x = clamp01((e.clientX - r.left) / r.width);
    const y = clamp01((e.clientY - r.top) / r.height);
    return { x, y };
  }

  function syncPointers() {
    const points = Array.from(activePointersRef.current.values());
    setTouches(points);

    if (points.length === 0) {
      const restingPoint = { ...CENTER_POINT, pressure: 0 };
      setPt(restingPoint);
      update({ ...restingPoint, spread: 0, touchCount: 0 });
      return;
    }

    const nextPoint = averagePoints(points);
    const spread = calculateSpread(points);
    setPt(nextPoint);
    update({ ...nextPoint, spread, touchCount: points.length });
  }

  async function enterHere() {
    setHasEntered(true);
    setPt(CENTER_POINT);
    setTouches([]);
    await start();
    update({ ...CENTER_POINT, spread: 0, touchCount: 0 });
  }

  async function onPointerDown(e: React.PointerEvent) {
    if (!hasEntered) {
      setHasEntered(true);
    }

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const { x, y } = getXY(e);
    const pressure = clamp01(e.pressure || 0.5);
    activePointersRef.current.set(e.pointerId, { id: e.pointerId, x, y, pressure });

    await start();
    syncPointers();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!activePointersRef.current.has(e.pointerId)) return;

    const { x, y } = getXY(e);
    const pressure = clamp01(e.pressure || 0.5);
    activePointersRef.current.set(e.pointerId, { id: e.pointerId, x, y, pressure });
    syncPointers();
  }

  function releasePointer(e: React.PointerEvent) {
    activePointersRef.current.delete(e.pointerId);
    syncPointers();
  }

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        background:
          "radial-gradient(900px 640px at 50% 50%, rgba(120, 170, 255, 0.15), transparent 50%), radial-gradient(1200px 700px at 30% 10%, rgba(170, 210, 255, 0.16), transparent 60%), radial-gradient(900px 600px at 70% 40%, rgba(140, 160, 255, 0.14), transparent 62%), linear-gradient(180deg, rgba(10,12,22,1) 0%, rgba(6,7,14,1) 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `calc(50% - 56px)`,
          top: `calc(50% - 56px)`,
          width: 112,
          height: 112,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "radial-gradient(circle, rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
          boxShadow: hasEntered ? "0 0 60px rgba(140,200,255,0.14)" : "0 0 80px rgba(140,200,255,0.26)",
          opacity: hasEntered ? 0.55 : 0.95,
          transition: "opacity 180ms ease, box-shadow 180ms ease",
          pointerEvents: "none",
        }}
      />

      {touches.map((touch) => (
        <div
          key={touch.id}
          style={{
            position: "absolute",
            left: `calc(${touch.x * 100}% - 20px)`,
            top: `calc(${touch.y * 100}% - 20px)`,
            width: 40,
            height: 40,
            borderRadius: 999,
            background: "rgba(180, 220, 255, 0.85)",
            boxShadow: "0 0 40px rgba(140,200,255,0.35)",
            transform: `scale(${1 + touch.pressure * 0.8})`,
            transition: "transform 40ms linear",
            pointerEvents: "none",
            opacity: 0.92,
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: `calc(${pt.x * 100}% - 10px)`,
          top: `calc(${pt.y * 100}% - 10px)`,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: "linear-gradient(135deg, rgba(77,225,255,0.95), rgba(192,132,252,0.9))",
          boxShadow: "0 0 30px rgba(77,225,255,0.45)",
          transform: `scale(${1 + pt.pressure * 1.6})`,
          transition: activeTouchCount > 0 ? "transform 40ms linear" : "all 180ms ease",
          pointerEvents: "none",
          opacity: hasEntered ? 0.95 : 0.75,
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
        <div>fingers: {activeTouchCount}</div>
        <div>
          x: {pt.x.toFixed(2)} y: {pt.y.toFixed(2)}
        </div>
        <div>pressure: {pt.pressure.toFixed(2)}</div>
      </div>

      {entryVisible && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.2)",
            backdropFilter: "blur(3px)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              display: "grid",
              gap: 18,
              justifyItems: "center",
              width: "min(420px, 88vw)",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            <div>
              <div style={{ letterSpacing: "0.22em", fontSize: 12, opacity: 0.76 }}>
                CHAOS PAD
              </div>
              <div style={{ fontSize: 24, marginTop: 10, fontWeight: 600 }}>
                Press the circle to be here
              </div>
              <div style={{ marginTop: 10, fontSize: 14, opacity: 0.84, lineHeight: 1.5 }}>
                The center is the resonant tone of the place. Enter there, then use one or many
                fingers to pull the sound outward.
              </div>
            </div>

            <button
              type="button"
              onClick={enterHere}
              style={{
                width: 180,
                height: 180,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.16)",
                background:
                  "radial-gradient(circle at 50% 45%, rgba(110, 215, 255, 0.3), rgba(18, 22, 40, 0.88))",
                color: "rgba(255,255,255,0.95)",
                boxShadow: "0 0 90px rgba(77, 225, 255, 0.22)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              Be here
            </button>

            <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
              After you enter, drag one finger for a single voice or add more fingers to blend and
              widen the texture.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
