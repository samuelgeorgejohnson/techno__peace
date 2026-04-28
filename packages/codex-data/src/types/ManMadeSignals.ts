/**
 * Normalized intensity model for man-made environmental activity.
 */
export interface ManMadeSignalLayer {
  /** Relative signal density in the area (0-1). */
  density: number;
  /** Relative nearness/encroachment of the source (0-1). */
  proximity: number;
  /** Relative movement/kinetic activity (0-1). */
  motion: number;
  /** Relative strain/congestion/instability (0-1). */
  tension: number;
  /** Relative perceived brightness/presence (0-1). */
  brightness: number;
  /** Pulse cadence for modulation (normalized or Hz-like). */
  pulseRate: number;
}

/**
 * Air-traffic signal derived from nearby aircraft state vectors.
 */
export interface AirSignal {
  count: number;
  nearestDistanceKm?: number;
  avgAltitudeM?: number;
  avgVelocityMps?: number;
  headingSpread?: number;
  radialVelocityMps?: number;
  dopplerRatio?: number;
  dopplerCents?: number;
  nearestApproachBias?: number;
  normalized: ManMadeSignalLayer;
}

/**
 * Subway signal derived from train/station proximity and timing.
 */
export interface SubwaySignal {
  trainsNearby: number;
  nearestStationDistanceM?: number;
  nearestTrainDistanceM?: number;
  avgArrivalSeconds?: number;
  delayed: boolean;
  moving: boolean;
  normalized: ManMadeSignalLayer;
}

/**
 * Normalized road traffic signal from TomTom flow segment data.
 */
export interface TrafficSignal {
  currentSpeedMph: number;
  freeFlowSpeedMph: number;
  currentTravelTimeSec: number;
  freeFlowTravelTimeSec: number;
  confidence: number;
  roadClosure: boolean;
  congestion: number;
  flow: number;
  delay: number;
  status: "live" | "unavailable" | "error";
}

/**
 * Bus-traffic signal derived from vehicles, stops, and arrivals.
 */
export interface BusSignal {
  busesNearby: number;
  nearestStopDistanceM?: number;
  avgArrivalSeconds?: number;
  bunching?: boolean;
  normalized: ManMadeSignalLayer;
}

/**
 * Container for all optional man-made source channels at a point in time.
 */
export interface ManMadeSignals {
  air?: AirSignal;
  subway?: SubwaySignal;
  road?: TrafficSignal;
  bus?: BusSignal;
}

/**
 * Mixer controls for balancing man-made channels in downstream systems.
 */
export interface ManMadeMixerState {
  master?: number;
  air?: number;
  subway?: number;
  road?: number;
  bus?: number;
}
