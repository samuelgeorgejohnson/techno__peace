import type { AirSignal, ManMadeSignalLayer } from "../types/ManMadeSignals";
import {
  buildListenerToPlaneVector,
  computeSafeDopplerMetrics,
  magnitude3,
} from "./airMotion";

const EARTH_RADIUS_KM = 6371;
const DEFAULT_TIMEOUT_MS = 8_000;

export interface AirTrafficRequest {
  lat: number;
  lon: number;
  radiusKm: number;
  limit?: number;
  listenerAltitudeM?: number;
}

export interface RawAircraftState {
  id: string;
  lat: number;
  lon: number;
  altitudeM?: number;
  velocityMps?: number;
  headingDeg?: number;
  onGround?: boolean;
}

export interface RawAirTrafficResponse {
  generatedAt: string;
  aircraft: RawAircraftState[];
}

export interface AirTrafficRuntimeConfig {
  /**
   * Base endpoint for the air-traffic provider.
   * Example: https://example-air-provider.io/v1/air-traffic
   */
  apiUrl?: string;
  /**
   * Credential token for the provider (if required by your provider).
   */
  apiKey?: string;
}

export interface FetchAirTrafficSignalOptions extends AirTrafficRuntimeConfig {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const average = (values: number[]): number | undefined => {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildNormalized = (params: {
  count: number;
  radiusKm: number;
  nearestDistanceKm?: number;
  avgVelocityMps?: number;
  avgAltitudeM?: number;
  headingSpread?: number;
}): ManMadeSignalLayer => {
  const safeRadiusKm = params.radiusKm > 0 ? params.radiusKm : undefined;
  const proximity = safeRadiusKm
    ? clamp01(1 - (params.nearestDistanceKm ?? safeRadiusKm) / safeRadiusKm)
    : 0;

  return {
    density: clamp01(params.count / 30),
    proximity,
    motion: clamp01((params.avgVelocityMps ?? 0) / 260),
    tension: clamp01((params.headingSpread ?? 0) / 180),
    brightness: clamp01((params.avgAltitudeM ?? 0) / 12_000),
    pulseRate: Number((0.4 + clamp01(params.count / 20) * 2.2).toFixed(3)),
  };
};

const normalizeBearing = (headingDeg: number): number => {
  const normalized = headingDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const computeHeadingSpread = (headings: number[]): number | undefined => {
  if (headings.length < 2) return undefined;

  const normalized = headings.map(normalizeBearing).sort((a, b) => a - b);
  let largestGap = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const next = index === normalized.length - 1 ? normalized[0] + 360 : normalized[index + 1];
    largestGap = Math.max(largestGap, next - current);
  }

  return 360 - largestGap;
};

const isRawAircraftState = (payload: unknown): payload is RawAircraftState => {
  if (!payload || typeof payload !== "object") return false;

  const candidate = payload as Partial<RawAircraftState>;
  const optionalAltitudeValid =
    candidate.altitudeM === undefined || isFiniteNumber(candidate.altitudeM);
  const optionalVelocityValid =
    candidate.velocityMps === undefined || isFiniteNumber(candidate.velocityMps);
  const optionalHeadingValid =
    candidate.headingDeg === undefined || isFiniteNumber(candidate.headingDeg);
  const optionalOnGroundValid =
    candidate.onGround === undefined || typeof candidate.onGround === "boolean";

  return (
    typeof candidate.id === "string" &&
    isFiniteNumber(candidate.lat) &&
    isFiniteNumber(candidate.lon) &&
    optionalAltitudeValid &&
    optionalVelocityValid &&
    optionalHeadingValid &&
    optionalOnGroundValid
  );
};

const isRawAirTrafficResponse = (payload: unknown): payload is RawAirTrafficResponse => {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Partial<RawAirTrafficResponse>;
  return (
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.aircraft) &&
    candidate.aircraft.every(isRawAircraftState)
  );
};

export const adaptAirTrafficResponse = (
  response: RawAirTrafficResponse,
  request: AirTrafficRequest,
): AirSignal => {
  const aircraftInRadius = response.aircraft
    .map((aircraft) => ({
      ...aircraft,
      distanceKm: haversineKm(request.lat, request.lon, aircraft.lat, aircraft.lon),
    }))
    .filter((aircraft) => aircraft.distanceKm <= request.radiusKm)
    .filter((aircraft) => !aircraft.onGround);

  const listener = {
    lat: request.lat,
    lon: request.lon,
    altitudeM: request.listenerAltitudeM ?? 0,
  };

  const enrichedAircraft = aircraftInRadius.map((aircraft) => {
    const listenerToPlane = buildListenerToPlaneVector(listener, {
      lat: aircraft.lat,
      lon: aircraft.lon,
      altitudeM: aircraft.altitudeM ?? 0,
    });
    const lineOfSightDistanceKm = magnitude3(listenerToPlane) / 1_000;

    return {
      ...aircraft,
      lineOfSightDistanceKm,
      doppler: computeSafeDopplerMetrics(
        listenerToPlane,
        aircraft.headingDeg,
        aircraft.velocityMps,
      ),
    };
  });

  const nearestDistanceKm = enrichedAircraft.length
    ? Math.min(...enrichedAircraft.map((aircraft) => aircraft.lineOfSightDistanceKm))
    : undefined;

  const avgAltitudeM = average(
    enrichedAircraft
      .map((aircraft) => aircraft.altitudeM)
      .filter((value): value is number => typeof value === "number"),
  );

  const avgVelocityMps = average(
    enrichedAircraft
      .map((aircraft) => aircraft.velocityMps)
      .filter((value): value is number => typeof value === "number"),
  );

  const headingSpread = (() => {
    const headings = enrichedAircraft
      .map((aircraft) => aircraft.headingDeg)
      .filter(isFiniteNumber);
    return computeHeadingSpread(headings);
  })();

  const primaryDoppler = enrichedAircraft.reduce<ReturnType<typeof computeSafeDopplerMetrics>>(
    (best, aircraft) => {
      if (!aircraft.doppler) return best;
      if (!best) return aircraft.doppler;
      return aircraft.doppler.nearestApproachBias > best.nearestApproachBias
        ? aircraft.doppler
        : best;
    },
    undefined,
  );

  const normalized = buildNormalized({
    count: aircraftInRadius.length,
    radiusKm: request.radiusKm,
    nearestDistanceKm,
    avgVelocityMps,
    avgAltitudeM,
    headingSpread,
  });

  return {
    count: aircraftInRadius.length,
    nearestDistanceKm,
    avgAltitudeM,
    avgVelocityMps,
    headingSpread,
    radialVelocityMps: primaryDoppler?.radialVelocityMps,
    dopplerRatio: primaryDoppler?.dopplerRatio,
    dopplerCents: primaryDoppler?.dopplerCents,
    nearestApproachBias: primaryDoppler?.nearestApproachBias,
    normalized,
  };
};

export const fetchAirTrafficSignal = async (
  request: AirTrafficRequest,
  options: FetchAirTrafficSignalOptions,
): Promise<AirSignal> => {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error("fetchAirTrafficSignal requires fetch support in runtime or options.fetchImpl");
  }

  if (!options.apiUrl) {
    throw new Error("Missing air-traffic API URL. Set AIR_TRAFFIC_API_URL in runtime config.");
  }

  const url = new URL(options.apiUrl);
  url.searchParams.set("lat", String(request.lat));
  url.searchParams.set("lon", String(request.lon));
  url.searchParams.set("radius_km", String(request.radiusKm));
  if (request.limit) url.searchParams.set("limit", String(request.limit));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // TODO(runtime-hookup): Confirm provider's auth scheme (Bearer/X-API-Key/etc).
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Air traffic request failed: ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    if (!isRawAirTrafficResponse(payload)) {
      throw new Error("Air traffic response did not match expected schema.");
    }

    return adaptAirTrafficResponse(payload, request);
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * TODO(runtime-hookup): Wire this helper to your app runtime and secret manager.
 */
export const resolveAirTrafficRuntimeConfig = (): AirTrafficRuntimeConfig => ({
  apiUrl:
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.AIR_TRAFFIC_API_URL,
  apiKey:
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.AIR_TRAFFIC_API_KEY,
});
