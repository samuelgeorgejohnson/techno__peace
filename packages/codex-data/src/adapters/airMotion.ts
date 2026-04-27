const EARTH_RADIUS_M = 6_371_000;
const SPEED_OF_SOUND_MPS = 343;

export interface GeoPoint {
  lat: number;
  lon: number;
  altitudeM?: number;
}

export interface EastNorthUpVector {
  eastM: number;
  northM: number;
  upM: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Converts small local latitude/longitude differences into planar meter offsets.
 * This keeps nearby-aircraft math readable without bringing in a heavy geodesy dependency.
 */
export const latLonDiffToEastNorthMeters = (
  origin: Pick<GeoPoint, "lat" | "lon">,
  target: Pick<GeoPoint, "lat" | "lon">,
): Pick<EastNorthUpVector, "eastM" | "northM"> => {
  const toRad = Math.PI / 180;
  const dLatRad = (target.lat - origin.lat) * toRad;
  const dLonRad = (target.lon - origin.lon) * toRad;
  const meanLatRad = ((origin.lat + target.lat) / 2) * toRad;

  return {
    eastM: dLonRad * Math.cos(meanLatRad) * EARTH_RADIUS_M,
    northM: dLatRad * EARTH_RADIUS_M,
  };
};

export const buildListenerToPlaneVector = (listener: GeoPoint, plane: GeoPoint): EastNorthUpVector => {
  const { eastM, northM } = latLonDiffToEastNorthMeters(listener, plane);
  return {
    eastM,
    northM,
    upM: (plane.altitudeM ?? 0) - (listener.altitudeM ?? 0),
  };
};

/**
 * Heading is interpreted in navigation convention (0°=north, 90°=east).
 */
export const buildPlaneVelocityVector = (
  headingDeg: number,
  velocityMps: number,
): Pick<EastNorthUpVector, "eastM" | "northM"> => {
  const headingRad = (headingDeg * Math.PI) / 180;
  return {
    eastM: Math.sin(headingRad) * velocityMps,
    northM: Math.cos(headingRad) * velocityMps,
  };
};

export const magnitude3 = (vector: EastNorthUpVector): number =>
  Math.hypot(vector.eastM, vector.northM, vector.upM);

/**
 * Positive radial velocity means approaching (distance shrinking).
 */
export const computeRadialVelocityMps = (
  listenerToPlane: EastNorthUpVector,
  planeVelocity: Pick<EastNorthUpVector, "eastM" | "northM">,
): number | undefined => {
  const distanceM = magnitude3(listenerToPlane);
  if (!Number.isFinite(distanceM) || distanceM < 1) return undefined;

  const unitFromListenerToPlane = {
    eastM: listenerToPlane.eastM / distanceM,
    northM: listenerToPlane.northM / distanceM,
  };

  const outwardRate =
    planeVelocity.eastM * unitFromListenerToPlane.eastM +
    planeVelocity.northM * unitFromListenerToPlane.northM;

  return -outwardRate;
};

export interface DopplerMetrics {
  radialVelocityMps: number;
  dopplerRatio: number;
  dopplerCents: number;
  nearestApproachBias: number;
}

export interface DopplerOptions {
  maxApproachRatio?: number;
  maxRecedeRatio?: number;
  maxCentsAbs?: number;
  maxRadialSpeedMps?: number;
  nearestApproachDistanceM?: number;
}

const DEFAULT_OPTIONS: Required<DopplerOptions> = {
  maxApproachRatio: 1.012,
  maxRecedeRatio: 0.988,
  maxCentsAbs: 20,
  maxRadialSpeedMps: 95,
  nearestApproachDistanceM: 3_500,
};

export const computeSafeDopplerMetrics = (
  listenerToPlane: EastNorthUpVector,
  headingDeg?: number,
  velocityMps?: number,
  options: DopplerOptions = {},
): DopplerMetrics | undefined => {
  if (!Number.isFinite(headingDeg) || !Number.isFinite(velocityMps) || velocityMps === undefined) {
    return undefined;
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  const speed = clamp(Math.abs(velocityMps), 0, config.maxRadialSpeedMps);
  const velocityVector = buildPlaneVelocityVector(headingDeg, speed);
  const radialVelocityMps = computeRadialVelocityMps(listenerToPlane, velocityVector);
  if (radialVelocityMps === undefined) return undefined;

  const boundedRadialVelocityMps = clamp(
    radialVelocityMps,
    -config.maxRadialSpeedMps,
    config.maxRadialSpeedMps,
  );

  const rawRatio =
    boundedRadialVelocityMps >= 0
      ? SPEED_OF_SOUND_MPS / (SPEED_OF_SOUND_MPS - boundedRadialVelocityMps)
      : (SPEED_OF_SOUND_MPS + boundedRadialVelocityMps) / SPEED_OF_SOUND_MPS;

  const dopplerRatio = clamp(rawRatio, config.maxRecedeRatio, config.maxApproachRatio);

  const dopplerCents = clamp(1200 * Math.log2(dopplerRatio), -config.maxCentsAbs, config.maxCentsAbs);

  const distanceM = magnitude3(listenerToPlane);
  const proximityFactor = 1 - clamp(distanceM / config.nearestApproachDistanceM, 0, 1);
  const approachFactor = clamp(boundedRadialVelocityMps / config.maxRadialSpeedMps, 0, 1);

  return {
    radialVelocityMps: boundedRadialVelocityMps,
    dopplerRatio,
    dopplerCents,
    nearestApproachBias: Number((proximityFactor * approachFactor).toFixed(4)),
  };
};
