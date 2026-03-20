import type { CSSProperties } from "react";
import type { AudioChannelStatus } from "../hooks/useAudioEngine";
import type { WeatherAudioMapping } from "../lib/weatherDiagnostics";

interface MixerOverlayProps {
  mapping: WeatherAudioMapping;
  channelStatus: AudioChannelStatus;
  onOpenDiagnostics: () => void;
  onClose: () => void;
}

const CHANNEL_LABELS: Array<[label: string, key: keyof AudioChannelStatus]> = [
  ["Base bed", "baseBed"],
  ["Wind layer", "windLayer"],
  ["Rain layer", "rainLayer"],
  ["Thunder layer", "thunderLayer"],
  ["Water layer", "waterLayer"],
  ["Master output", "masterOutput"],
];

export default function MixerOverlay({
  mapping,
  channelStatus,
  onOpenDiagnostics,
  onClose,
}: MixerOverlayProps) {
  return (
    <div style={backdropStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>TEMP MIXER PAGE</div>
            <h2 style={titleStyle}>Mixer / routing</h2>
            <p style={subtitleStyle}>
              This is a temporary mixer surface so diagnostics live on the mixer page instead of the main Sky Mode screen.
            </p>
          </div>

          <div style={buttonRowStyle}>
            <button style={secondaryButtonStyle} onClick={onOpenDiagnostics}>
              DEBUG
            </button>
            <button style={primaryButtonStyle} onClick={onClose}>
              Close mixer
            </button>
          </div>
        </div>

        <div style={gridStyle}>
          <section style={cardStyle}>
            <div style={cardTitleStyle}>Weather-driven targets</div>
            <div style={metricRowStyle}>
              <span>Wind noise gain</span>
              <strong>{mapping.windNoiseGain.toFixed(2)}</strong>
            </div>
            <div style={metricRowStyle}>
              <span>Rain texture gain</span>
              <strong>{mapping.rainTextureGain.toFixed(2)}</strong>
            </div>
            <div style={metricRowStyle}>
              <span>Low-pass cutoff</span>
              <strong>{mapping.lowpassCutoffHz.toFixed(0)} Hz</strong>
            </div>
            <div style={metricRowStyle}>
              <span>Harmonic brightness</span>
              <strong>{mapping.harmonicBrightness.toFixed(2)}</strong>
            </div>
            <div style={metricRowStyle}>
              <span>Sun LFO rate</span>
              <strong>{mapping.sunLfoRateHz.toFixed(2)} Hz</strong>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={cardTitleStyle}>Channel truth panel</div>
            {CHANNEL_LABELS.map(([label, key]) => (
              <div key={label} style={metricRowStyle}>
                <span>{label}</span>
                <strong>{channelStatus[key] ? "active" : "inactive"}</strong>
              </div>
            ))}
            <div style={metricRowStyle}>
              <span>Audio context</span>
              <strong>{channelStatus.audioContext}</strong>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 25,
  background: "rgba(3, 8, 18, 0.88)",
  backdropFilter: "blur(12px)",
  padding: "72px 12px 16px",
  overflowY: "auto",
};

const panelStyle: CSSProperties = {
  width: "min(920px, 100%)",
  margin: "0 auto",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(7, 14, 27, 0.96)",
  color: "#eef6ff",
  padding: 16,
  boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.16em",
  opacity: 0.7,
};

const titleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 28,
};

const subtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  maxWidth: 520,
  lineHeight: 1.5,
  color: "rgba(238, 246, 255, 0.78)",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const baseButtonStyle: CSSProperties = {
  borderRadius: 999,
  padding: "10px 14px",
  border: "1px solid rgba(255,255,255,0.12)",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "rgba(255,255,255,0.06)",
  color: "#e5f2ff",
};

const primaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "#d4f6ff",
  color: "#062436",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const cardStyle: CSSProperties = {
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  padding: 14,
};

const cardTitleStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 16,
  marginBottom: 12,
};

const metricRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderTop: "1px solid rgba(255,255,255,0.06)",
};
