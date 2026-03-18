import type { CSSProperties } from "react";
import type { AudioChannelStatus } from "../hooks/useAudioEngine";
import type { WeatherAudioMapping, WeatherDiagnosticsState } from "../lib/weatherDiagnostics";

interface DiagnosticsOverlayProps {
  diagnostics: WeatherDiagnosticsState;
  mapping: WeatherAudioMapping;
  channelStatus: AudioChannelStatus;
  isAudioRunning: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatNumber(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function DataTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; timestamp?: string; source?: string }>;
}) {
  return (
    <section style={sectionStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headCellStyle}>Field</th>
              <th style={headCellStyle}>Value</th>
              <th style={headCellStyle}>Timestamp</th>
              <th style={headCellStyle}>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td style={cellStyle}>{row.label}</td>
                <td style={cellStyle}>{row.value}</td>
                <td style={cellStyle}>{row.timestamp ?? "—"}</td>
                <td style={cellStyle}>{row.source ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DiagnosticsOverlay({
  diagnostics,
  mapping,
  channelStatus,
  isAudioRunning,
  onClose,
  onRefresh,
}: DiagnosticsOverlayProps) {
  const weather = diagnostics.weather;
  const sharedTimestamp = formatTime(weather.dataTimestampIso);
  const sourceLabel = weather.isMocked ? `${weather.sourceStatus} (explicitly mocked)` : weather.sourceStatus;

  const weatherRows = [
    { label: "Location", value: `${weather.locationName} (${weather.latitude.toFixed(4)}, ${weather.longitude.toFixed(4)})`, timestamp: formatTime(weather.currentTimeIso), source: weather.locationSource },
    { label: "Current time", value: formatTime(weather.currentTimeIso), timestamp: formatTime(weather.currentTimeIso), source: sourceLabel },
    { label: "Data timestamp", value: formatTime(weather.dataTimestampIso), timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Temperature", value: `${formatNumber(weather.temperatureC, 1)} °C`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Humidity", value: `${formatNumber(weather.humidityPct, 0)}%`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Wind speed", value: `${formatNumber(weather.windSpeedMps, 1)} m/s`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Cloud cover", value: `${formatNumber(weather.cloudCoverPct, 0)}%`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Precipitation", value: `${formatNumber(weather.precipitationMm, 2)} mm`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Rain", value: `${formatNumber(weather.rainMm, 2)} mm`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Condition", value: `${weather.weatherDescription} (code ${weather.weatherCode})`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Sunrise / Sunset", value: `${formatTime(weather.sunriseIso)} / ${formatTime(weather.sunsetIso)}`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Sun altitude", value: weather.sunAltitudeDeg == null ? "Unavailable" : `${formatNumber(weather.sunAltitudeDeg, 1)}°`, timestamp: sharedTimestamp, source: sourceLabel },
  ];

  const mappingRows = [
    { label: "Wind speed → windNoiseGain", value: formatNumber(mapping.windNoiseGain), timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Wind speed → windFilterLFO", value: formatNumber(mapping.windFilterLfo), timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Cloud cover → lowpassCutoff", value: `${formatNumber(mapping.lowpassCutoffHz, 0)} Hz`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Humidity/rain → rainTextureGain", value: formatNumber(mapping.rainTextureGain), timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Temp/sunlight → harmonicBrightness", value: formatNumber(mapping.harmonicBrightness), timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Sun altitude → sunLfoRate", value: `${formatNumber(mapping.sunLfoRateHz)} Hz`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Temperature/clouds → baseFrequency", value: `${formatNumber(mapping.baseFrequencyHz, 1)} Hz`, timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Humidity/rain → waterLayerGain", value: formatNumber(mapping.waterLayerGain), timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Storm flag → thunderEnabled", value: mapping.thunderEnabled ? "true" : "false", timestamp: sharedTimestamp, source: sourceLabel },
    { label: "Weather blend → masterGain", value: formatNumber(mapping.masterGain), timestamp: sharedTimestamp, source: sourceLabel },
  ];

  const statusItems = [
    ["API status", diagnostics.fetchStatus === "success" ? "success" : `failed (${diagnostics.errorMessage ?? "unknown"})`],
    ["Source", sourceLabel],
    ["Last fetch", formatTime(diagnostics.lastFetchTimeIso ?? weather.fetchedAtIso)],
    ["Location used", `${weather.latitude.toFixed(4)}, ${weather.longitude.toFixed(4)} • ${weather.locationName}`],
    ["Refresh interval", `${Math.round(weather.refreshIntervalMs / 1000)} sec`],
    ["Raw endpoint", weather.rawEndpoint],
    ["Audio engine started", isAudioRunning ? "yes" : "no"],
    ["Active weather-driven channels", `${mapping.activeWeatherDrivenChannels}`],
  ];

  const channelItems = [
    ["Base bed", channelStatus.baseBed ? "active" : "inactive"],
    ["Wind layer", channelStatus.windLayer ? "active" : "inactive"],
    ["Rain layer", channelStatus.rainLayer ? "active" : "inactive"],
    ["Thunder layer", channelStatus.thunderLayer ? "active" : "inactive"],
    ["Water layer", channelStatus.waterLayer ? "active" : "inactive"],
    ["Master output", channelStatus.masterOutput ? "active" : "inactive"],
    ["Audio context", channelStatus.audioContext],
  ];

  const diagnosticsPayload = JSON.stringify(
    {
      diagnostics,
      mapping,
      channelStatus,
      generatedAt: new Date().toISOString(),
    },
    null,
    2
  );

  return (
    <div style={backdropStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>DEBUG / DIAGNOSTICS</div>
            <h2 style={titleStyle}>Sky Mode truth panel</h2>
          </div>
          <div style={buttonRowStyle}>
            <button style={secondaryButtonStyle} onClick={onRefresh}>
              Refresh weather
            </button>
            <button
              style={secondaryButtonStyle}
              onClick={async () => {
                await navigator.clipboard.writeText(diagnosticsPayload);
              }}
            >
              Copy diagnostics JSON
            </button>
            <button style={primaryButtonStyle} onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>Fetch status</div>
          <div style={statusGridStyle}>
            {statusItems.map(([label, value]) => (
              <div key={label} style={statusCardStyle}>
                <div style={statusLabelStyle}>{label}</div>
                <div style={statusValueStyle}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        <DataTable title="Weather data" rows={weatherRows} />
        <DataTable title="Audio mapping" rows={mappingRows} />

        <section style={sectionStyle}>
          <div style={sectionTitleStyle}>Channel status</div>
          <div style={statusGridStyle}>
            {channelItems.map(([label, value]) => (
              <div key={label} style={statusCardStyle}>
                <div style={statusLabelStyle}>{label}</div>
                <div style={statusValueStyle}>{value}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(4, 8, 18, 0.82)",
  backdropFilter: "blur(10px)",
  padding: "72px 12px 16px",
  overflowY: "auto",
  zIndex: 30,
};

const panelStyle: CSSProperties = {
  width: "min(1100px, 100%)",
  margin: "0 auto",
  padding: "16px",
  borderRadius: 20,
  background: "rgba(8, 13, 26, 0.94)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#ecf4ff",
  boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
  marginBottom: 16,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.18em",
  opacity: 0.72,
};

const titleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 28,
  lineHeight: 1.1,
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
  fontWeight: 600,
};

const secondaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "rgba(255,255,255,0.06)",
  color: "#e4efff",
};

const primaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  background: "#d4f6ff",
  color: "#082033",
};

const sectionStyle: CSSProperties = {
  marginTop: 16,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 12,
};

const statusGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const statusCardStyle: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  overflowWrap: "anywhere",
};

const statusLabelStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const statusValueStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.4,
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 680,
};

const headCellStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  background: "rgba(255,255,255,0.06)",
};

const cellStyle: CSSProperties = {
  padding: "12px 14px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  verticalAlign: "top",
  fontSize: 14,
};
