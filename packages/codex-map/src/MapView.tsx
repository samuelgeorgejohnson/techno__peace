import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LeafletEvent } from "leaflet";

import type { LocationBundle } from "./LocationBundle";

interface MapViewProps {
  location: LocationBundle;
  onLocationChange?: (bundle: LocationBundle) => void;
}

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const MapCenterSync = ({ lat, lon }: { lat: number; lon: number }) => {
  const map = useMap();

  useEffect(() => {
    map.setView([lat, lon], map.getZoom(), { animate: true });
  }, [lat, lon, map]);

  return null;
};

const MapClickHandler = ({
  onPick,
}: {
  onPick: (lat: number, lon: number) => void;
}) => {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
};

export const MapView = ({ location, onLocationChange }: MapViewProps) => {
  const markerPosition = useMemo(
    () => ({ lat: location.lat, lon: location.lon }),
    [location.lat, location.lon]
  );

  const emitLocationChange = (lat: number, lon: number) => {
    if (!onLocationChange) {
      return;
    }

    onLocationChange({
      ...location,
      lat,
      lon,
    });
  };

  return (
    <div
      style={{
        width: "100%",
        height: 280,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.12)",
      }}
    >
      <MapContainer
        center={[location.lat, location.lon]}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapCenterSync lat={location.lat} lon={location.lon} />

        {onLocationChange && <MapClickHandler onPick={emitLocationChange} />}

        <Marker
          position={[markerPosition.lat, markerPosition.lon]}
          draggable={Boolean(onLocationChange)}
          icon={markerIcon}
          eventHandlers={{
            dragend(event: LeafletEvent) {
              const next = (event.target as L.Marker).getLatLng();
              emitLocationChange(next.lat, next.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
};
