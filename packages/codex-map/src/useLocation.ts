import { useEffect, useState } from "react";
import type { LocationBundle } from "./LocationBundle";

type LocationSource = "default" | "gps" | "manual";

type LocationState = {
  location: LocationBundle;
  error: string | null;
  isRequesting: boolean;
  source: LocationSource;
};

const STORAGE_KEY = "technopeace.manual-location";

const defaultBundle: LocationBundle = {
  lat: 0,
  lon: 0,
  date: new Date().toISOString().slice(0, 10),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

const listeners = new Set<(state: LocationState) => void>();

let state: LocationState = {
  location: defaultBundle,
  error: null,
  isRequesting: false,
  source: "default",
};

let isInitialized = false;

function emit() {
  for (const listener of listeners) {
    listener(state);
  }
}

function updateState(partial: Partial<LocationState>) {
  state = { ...state, ...partial };
  emit();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toManualBundle(input: LocationBundle): LocationBundle {
  return {
    ...input,
    lat: clamp(input.lat, -90, 90),
    lon: clamp(input.lon, -180, 180),
    date: input.date || new Date().toISOString().slice(0, 10),
    timezone: input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function hydrateManualLocation() {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<LocationBundle>;
    if (typeof parsed.lat !== "number" || typeof parsed.lon !== "number") return;

    const manual = toManualBundle({
      lat: parsed.lat,
      lon: parsed.lon,
      altitude: typeof parsed.altitude === "number" ? parsed.altitude : undefined,
      placeName: typeof parsed.placeName === "string" ? parsed.placeName : undefined,
      date: typeof parsed.date === "string" ? parsed.date : new Date().toISOString().slice(0, 10),
      timezone:
        typeof parsed.timezone === "string"
          ? parsed.timezone
          : Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    state = {
      ...state,
      location: manual,
      source: "manual",
      error: null,
    };
  } catch {
    // ignore corrupt local storage
  }
}

function persistManualLocation(location: LocationBundle) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
}

function requestCurrentLocation(force = false) {
  if (state.source === "manual" && !force) {
    return;
  }

  if (!navigator.geolocation) {
    updateState({ error: "geolocation-unavailable", isRequesting: false });
    return;
  }

  updateState({ isRequesting: true, error: null });

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      updateState({
        location: {
          ...state.location,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          altitude: pos.coords.altitude ?? state.location.altitude,
          date: new Date().toISOString().slice(0, 10),
        },
        source: "gps",
        error: null,
        isRequesting: false,
      });
    },
    () => {
      updateState({ error: "geolocation-denied", isRequesting: false });
    },
    { enableHighAccuracy: true, maximumAge: 10_000 }
  );
}

function setManualLocation(location: LocationBundle) {
  const next = toManualBundle(location);
  persistManualLocation(next);
  updateState({
    location: next,
    source: "manual",
    error: null,
  });
}

function init() {
  if (isInitialized) return;
  isInitialized = true;

  hydrateManualLocation();

  if (state.source !== "manual") {
    requestCurrentLocation();
  }
}

export const useLocation = () => {
  const [snapshot, setSnapshot] = useState(state);

  useEffect(() => {
    init();

    const listener = (next: LocationState) => setSnapshot(next);
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    location: snapshot.location,
    error: snapshot.error,
    isRequestingLocation: snapshot.isRequesting,
    source: snapshot.source,
    setLocation: setManualLocation,
    setManualLocation,
    requestCurrentLocation,
  } as const;
};
