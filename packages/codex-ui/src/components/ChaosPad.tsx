import { useMemo, useRef } from "react";
import { ChaosContext } from "../contexts/ChaosContext";
import { useChaosController } from "../hooks/useChaosController";

interface ChaosPadProps {
  showStats?: boolean;
}

export const ChaosPad = ({ showStats = false }: ChaosPadProps) => {
  const padRef = useRef<HTMLDivElement>(null);
  const chaos = useChaosController(padRef);

  const gradientStyle = useMemo(() => {
    const xPercent = chaos.x * 100;
    const yPercent = chaos.y * 100;
    const radius = 30 + chaos.pressure * 20;
    const alpha = 0.25 + chaos.pressure * 0.5;

    return {
      background: `radial-gradient(circle ${radius}% at ${xPercent}% ${yPercent}%, rgba(120, 200, 255, ${alpha}), rgba(20, 15, 35, 0.85))`,
      transition: chaos.active ? "none" : "background 180ms ease",
    } as const;
  }, [chaos]);

  return (
    <ChaosContext.Provider value={chaos}>
      <div
        ref={padRef}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "16px",
          overflow: "hidden",
          backgroundColor: "#0e0b16",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          cursor: "crosshair",
          touchAction: "none",
          ...gradientStyle,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #4de1ff, #c084fc)",
            boxShadow: "0 0 20px rgba(77, 225, 255, 0.6)",
            transform: "translate(-50%, -50%)",
            left: `${chaos.x * 100}%`,
            top: `${chaos.y * 100}%`,
            opacity: chaos.active ? 1 : 0.8,
            transition: chaos.active ? "none" : "opacity 180ms ease, left 180ms ease, top 180ms ease",
          }}
        />
        {showStats && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.4)",
              color: "#e8eef6",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <div><strong>gesture</strong>: {chaos.gesture}</div>
            <div><strong>x</strong>: {chaos.x.toFixed(2)}</div>
            <div><strong>y</strong>: {chaos.y.toFixed(2)}</div>
            <div><strong>pressure</strong>: {chaos.pressure.toFixed(2)}</div>
            <div><strong>tilt</strong>: {chaos.tiltX.toFixed(2)}, {chaos.tiltY.toFixed(2)}</div>
          </div>
        )}
      </div>
    </ChaosContext.Provider>
  );
};
