import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L, { type LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LocationBundle } from "./LocationBundle";

interface MapViewProps {
  location: LocationBundle;
  onLocationChange?: (bundle: LocationBundle) => void;
  className?: string;
  style?: CSSProperties;
}

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function reverseGeocode(lat: number, lon: number, signal: AbortSignal) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: lat.toString(),
    lon: lon.toString(),
    zoom: "10",
    addressdetails: "1",
  });

  return fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    signal,
    headers: {
      Accept: "application/json",
    },
  }).then(async (response) => {
    if (!response.ok) throw new Error(`reverse-geocode-${response.status}`);
    const payload = await response.json();
    return typeof payload.display_name === "string" ? payload.display_name : undefined;
  });
}

function LocationEvents({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center);
  }, [center, map]);

  return null;
}

export const MapView = ({ location, onLocationChange, className, style }: MapViewProps) => {
  const [position, setPosition] = useState(() => ({ lat: location.lat, lon: location.lon }));

  useEffect(() => {
    setPosition({ lat: location.lat, lon: location.lon });
  }, [location.lat, location.lon]);

  const center = useMemo<[number, number]>(() => [position.lat, position.lon], [position.lat, position.lon]);

  const emitLocation = (lat: number, lon: number) => {
    const clampedLat = Math.max(-90, Math.min(90, lat));
    const clampedLon = Math.max(-180, Math.min(180, lon));
    setPosition({ lat: clampedLat, lon: clampedLon });

    if (!onLocationChange) return;

    const baseBundle: LocationBundle = {
      ...location,
      lat: clampedLat,
      lon: clampedLon,
      date: new Date().toISOString().slice(0, 10),
    };

    onLocationChange(baseBundle);

    const controller = new AbortController();
    void reverseGeocode(clampedLat, clampedLon, controller.signal)
      .then((placeName) => {
        if (placeName) {
          onLocationChange({ ...baseBundle, placeName });
        }
      })
      .catch(() => {
        // reverse geocode optional
      });
  };

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 240,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        ...style,
      }}
    >
      <MapContainer
        center={center}
        zoom={6}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap center={center} />
        <LocationEvents onPick={emitLocation} />
        <Marker
          position={center}
          draggable
          icon={markerIcon}
          eventHandlers={{
            dragend(event: L.DragEndEvent) {
              const marker = event.target as L.Marker;
              const next = marker.getLatLng();
              emitLocation(next.lat, next.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
};
