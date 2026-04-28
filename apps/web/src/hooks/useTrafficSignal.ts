import { useEffect, useMemo, useRef, useState } from "react";
import type { TrafficSignal } from "@technopeace/codex-data/types/ManMadeSignals";
import type { ServerSignalsPayload } from "@technopeace/codex-data/types/SignalPayload";

export type TrafficSignalState = {
  status: "idle" | "loading" | "live" | "unavailable" | "error";
  traffic: TrafficSignal | null;
  error?: string;
};

const POLL_INTERVAL_MS = 90_000;
const COORD_BUCKET_DEGREES = 0.0025;

const DEFAULT_STATE: TrafficSignalState = {
  status: "idle",
  traffic: null,
};

function clampCoord(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : 0;
}

function bucketCoord(value: number) {
  return Math.round(value / COORD_BUCKET_DEGREES) * COORD_BUCKET_DEGREES;
}

function parsePayload(payload: unknown): TrafficSignalState {
  if (!payload || typeof payload !== "object") {
    return { status: "error", traffic: null, error: "invalid-payload" };
  }

  const typed = payload as Partial<ServerSignalsPayload>;
  const traffic = typed.manMade?.road ?? null;
  const status = typed.meta?.roadStatus;

  if (status === "live" && traffic) {
    return { status: "live", traffic };
  }

  if (status === "unavailable") {
    return {
      status: "unavailable",
      traffic: null,
      error: typed.meta?.roadError,
    };
  }

  return { status: "error", traffic: null, error: "missing-road-status" };
}

export function useTrafficSignal(latitude: number, longitude: number) {
  const [state, setState] = useState<TrafficSignalState>(DEFAULT_STATE);
  const cacheRef = useRef<Map<string, { expiresAt: number; value: TrafficSignalState }>>(new Map());

  const lat = useMemo(() => clampCoord(latitude, -90, 90), [latitude]);
  const lon = useMemo(() => clampCoord(longitude, -180, 180), [longitude]);
  const bucketLat = useMemo(() => bucketCoord(lat), [lat]);
  const bucketLon = useMemo(() => bucketCoord(lon), [lon]);
  const cacheKey = `${bucketLat.toFixed(4)},${bucketLon.toFixed(4)}`;

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | null = null;

    async function loadTraffic() {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        setState(cached.value);
        return;
      }

      setState((current) => ({
        ...current,
        status: current.status === "live" ? "live" : "loading",
      }));

      const query = new URLSearchParams({ lat: bucketLat.toString(), lon: bucketLon.toString() });

      try {
        const response = await fetch(`/signals?${query.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`signals-http-${response.status}`);
        }

        const payload = (await response.json()) as unknown;
        const parsed = parsePayload(payload);
        cacheRef.current.set(cacheKey, { expiresAt: Date.now() + POLL_INTERVAL_MS, value: parsed });
        setState(parsed);
      } catch (error) {
        if (controller.signal.aborted) return;

        const nextState: TrafficSignalState = {
          status: "error",
          traffic: null,
          error: error instanceof Error ? error.message : "traffic-fetch-failed",
        };
        cacheRef.current.set(cacheKey, { expiresAt: Date.now() + 15_000, value: nextState });
        setState(nextState);
      }
    }

    void loadTraffic();
    timer = window.setInterval(() => {
      void loadTraffic();
    }, POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [bucketLat, bucketLon, cacheKey]);

  return state;
}
