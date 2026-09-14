export type MapPosition = [number, number];
export type LandPolygon = { type: "Polygon"; coordinates: MapPosition[][] };
export type LandMap = {
  version: 1;
  basemap: "satellite" | "street";
  showBoundary: boolean;
  boundary: LandPolygon[];
  selection: LandPolygon[];
};
export const MAX_MAP_POINTS: number;
export const MAX_MAP_POLYGONS: number;
export function validateLandMap(value: unknown): string | null;
export function cleanLandMap(value: unknown): LandMap | null;
export function publicLandMap(value: unknown): LandMap | null;
