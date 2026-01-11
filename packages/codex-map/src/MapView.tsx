import type { LocationBundle } from "./LocationBundle";

interface MapViewProps {
  location: LocationBundle;
  onLocationChange?: (bundle: LocationBundle) => void;
}

export const MapView = ({ location, onLocationChange }: MapViewProps) => {
  return (
    <div
      style={{
        width: "100%",
        height: "240px",
        borderRadius: 16,
        background: "linear-gradient(135deg, #10131f, #0d2035)",
        color: "#b8c7da",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px dashed rgba(255,255,255,0.1)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 600 }}>Map placeholder</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Lat {location.lat.toFixed(3)}, Lon {location.lon.toFixed(3)}
        </div>
        {onLocationChange && (
          <button
            style={{
              marginTop: 12,
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.08)",
              color: "#e5edff",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
            }}
            onClick={() =>
              onLocationChange({
                ...location,
                lat: location.lat + 0.01,
                lon: location.lon + 0.01,
              })
            }
          >
            Nudge location
          </button>
        )}
      </div>
    </div>
  );
};
