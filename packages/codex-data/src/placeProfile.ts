export type PlaceCategory =
  | "ridge_park"
  | "mountain_forest"
  | "river_town"
  | "urban_core"
  | "waterfront_urban"
  | "residential_industrial"
  | "mountain_river_threshold"
  | "interior_commercial"
  | "mixed";

export interface PlaceProfile {
  density: number;
  hardness: number;
  openness: number;
  waterPresence: number;
  humanActivity: number;
  mechanicalActivity: number;
  vegetation: number;
  reflectivity: number;
  spectacle: number;
  containment: number;
}

export interface PlaceDefinition {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lon: number;
  descriptor?: string;
  profile: PlaceProfile;
}
