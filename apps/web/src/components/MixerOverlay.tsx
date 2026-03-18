import type { MixerParams } from "../audio/audioEngine";

type MixerOverlayProps = {
  open: boolean;
  isRunning: boolean;
  values: MixerParams;
  onChange: (name: keyof MixerParams, value: number) => void;
  onClose: () => void;
};

type SliderDef = {
  key: keyof MixerParams;
  label: string;
  hint: string;
};

const SLIDERS: SliderDef[] = [
  { key: "master", label: "Master", hint: "Overall scene intensity" },
  { key: "wind", label: "Wind", hint: "Band-passed air and filter motion" },
  { key: "rain", label: "Rain", hint: "Droplet spray and stereo wash" },
  { key: "shimmer", label: "Shimmer", hint: "Upper harmonic glow" },
  { key: "pulse", label: "Pulse", hint: "Slow breathing movement" },
];

function sliderRowStyle() {
  return {
    display: "grid",
    gap: 8,
    padding: "14px 16px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  } as const;
}

export default function MixerOverlay({ open, isRunning, values, onChange, onClose }: MixerOverlayProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: "rgba(2, 6, 20, 0.28)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        padding: 20,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width: "min(440px, 100%)",
          maxHeight: "calc(100vh - 40px)",
          overflow: "auto",
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "linear-gradient(180deg, rgba(10, 16, 36, 0.92), rgba(7, 11, 26, 0.92))",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.42)",
          padding: "22px 20px 20px",
          color: "rgba(255,255,255,0.92)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close mixer"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 38,
            height: 38,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            cursor: "pointer",
            fontSize: 20,
          }}
        >
          ×
        </button>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.72 }}>
              Sky mixer
            </div>
            <h2 style={{ margin: "8px 0 6px", fontSize: 28, lineHeight: 1.05 }}>Shape the storm without leaving the pad.</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.78 }}>
              The chaos pad stays live underneath. Audio keeps running while you rebalance the layered engine.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 18,
              background: isRunning ? "rgba(99, 180, 255, 0.14)" : "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.72 }}>Engine</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{isRunning ? "Running" : "Waiting for first touch"}</div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>Tap the field, then mix the layers.</div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {SLIDERS.map((slider) => {
              const value = values[slider.key];
              return (
                <label key={slider.key} style={sliderRowStyle()}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{slider.label}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>{slider.hint}</div>
                    </div>
                    <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, opacity: 0.85 }}>{Math.round(value * 100)}%</div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={value}
                    onChange={(event) => onChange(slider.key, Number(event.target.value))}
                    style={{ width: "100%" }}
                  />
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
