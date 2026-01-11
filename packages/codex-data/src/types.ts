export interface HourlySignal {
  hour: number;
  cloudCover: number;
  windMps: number;
  sunAltitudeDeg: number;
  moonPhase: number;
}

export interface SignalBundle {
  date: string;
  lat: number;
  lon: number;
  hours: HourlySignal[];
}

export interface Ring {
  id: string;
  radius: number;
  thickness: number;
  intensity: number;
  color: string;
}

export interface Modulation {
  tone: number;
  lfoRate: number;
  filterShift: number;
  shimmer?: number;
  warp?: number;
}
