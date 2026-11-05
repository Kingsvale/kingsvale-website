import type { LandMap, LandPolygon } from "./landMap";

export type MapRuntime = {
  provider: "google" | "leaflet";
  setGeometry: (value: LandMap | null, editable: boolean) => void;
  readSelection: () => LandPolygon[];
  fit: (polygons?: LandPolygon[]) => void;
  locate: (lat: number, lng: number, zoom: number) => void;
  setBasemap: (basemap: LandMap["basemap"]) => void;
  startDrawing: (complete: (polygon: LandPolygon) => boolean | void, end: () => void) => void;
  stopDrawing: () => void;
  edit: (remove: boolean) => void;
  stopEditing: () => void;
  restore: (polygons: LandPolygon[]) => void;
  destroy: () => void;
};

export const selectionStyle = { color: "#ef4444", weight: 2.5, fillColor: "#ef4444", fillOpacity: 0.28 };
