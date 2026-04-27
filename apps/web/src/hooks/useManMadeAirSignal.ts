import { useEffect, useMemo, useState } from "react";
import type { ServerSignalsPayload } from "@technopeace/codex-data/types/SignalPayload";
import type { AirSignal } from "@technopeace/codex-data/types/ManMadeSignals";

export type AirSignalState = {
  status: "idle" | "loading" | "live" | "unavailable" | "error";
  air: AirSignal | null;
  error?: string;
};

const DEFAULT_STATE: AirSignalState = {
  status: "idle",
  air: null,
};

function clampCoord(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : 0;
}

function parseSignalsPayload(payload: unknown): AirSignalState {
  if (!payload || typeof payload !== "object") {
    return { status: "error", air: null, error: "invalid-payload" };
  }

  const typed = payload as Partial<ServerSignalsPayload>;
  const air = typed.manMade?.air ?? null;
  const status = typed.meta?.airStatus;

  if (status === "live" && air) {
    return { status: "live", air };
  }

  if (status === "unavailable") {
    return {
      status: "unavailable",
      air: null,
      error: typed.meta?.airError,
    };
  }

  return { status: "error", air: null, error: "missing-air-status" };
}

export function useManMadeAirSignal(latitude: number, longitude: number) {
  const [state, setState] = useState<AirSignalState>(DEFAULT_STATE);

  const lat = useMemo(() => clampCoord(latitude, -90, 90), [latitude]);
  const lon = useMemo(() => clampCoord(longitude, -180, 180), [longitude]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSignal() {
      setState((current) => ({
        ...current,
        status: current.status === "live" ? "live" : "loading",
      }));

      const query = new URLSearchParams({ lat: lat.toString(), lon: lon.toString() });

      try {
        const response = await fetch(`/signals?${query.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`signals-http-${response.status}`);
        }

        const payload = (await response.json()) as unknown;
        setState(parseSignalsPayload(payload));
      } catch (error) {
        if (controller.signal.aborted) return;

        setState({
          status: "error",
          air: null,
          error: error instanceof Error ? error.message : "signals-fetch-failed",
        });
      }
    }

    void loadSignal();

    return () => controller.abort();
  }, [lat, lon]);

  return state;
}
