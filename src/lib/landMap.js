// Shared by the browser and secure server. Store geometry only, never KML markup.
export const MAX_MAP_POINTS = 10000;
export const MAX_MAP_POLYGONS = 100;

export function validateLandMap(value) {
  if (value == null) return null;
  if (typeof value !== "object" || value.version !== 1 ||
      !["satellite", "street"].includes(value.basemap) || typeof value.showBoundary !== "boolean") {
    return "The land map is invalid. Upload a KML or draw the area again.";
  }
  let points = 0;
  for (const key of ["boundary", "selection"]) {
    const polygons = value[key];
    if (!Array.isArray(polygons) || polygons.length > MAX_MAP_POLYGONS || (key === "selection" && !polygons.length)) {
      return "Choose at least one area of interest, with no more than 100 polygons.";
    }
    for (const polygon of polygons) {
      if (!polygon || polygon.type !== "Polygon" || !Array.isArray(polygon.coordinates) || !polygon.coordinates.length) {
        return "The land map must contain polygon boundaries.";
      }
      for (const ring of polygon.coordinates) {
        if (!Array.isArray(ring) || ring.length < 4) return "Each boundary needs at least three corners.";
        points += ring.length;
        if (points > MAX_MAP_POINTS) return "This map is too detailed. Use fewer than 10,000 boundary points.";
        for (const p of ring) {
          if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 85) {
            return "The land map contains invalid longitude or latitude coordinates.";
          }
        }
        const first = ring[0], last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) return "Each polygon boundary must be closed.";
        // Translate to the first vertex to avoid cancellation for small plots.
        const area = ring.slice(1).reduce((sum, p, i) => sum +
          (ring[i][0] - first[0]) * (p[1] - first[1]) - (p[0] - first[0]) * (ring[i][1] - first[1]), 0);
        if (Math.abs(area) < 1e-14) return "A boundary must enclose an area, rather than a line.";
      }
    }
  }
  return null;
}

export function cleanLandMap(value) {
  if (value == null || validateLandMap(value)) return null;
  const copy = (polygons) => polygons.map((p) => ({
    type: "Polygon",
    coordinates: p.coordinates.map((ring) => ring.map(([lng, lat]) => [lng, lat]))
  }));
  return { version: 1, basemap: value.basemap, showBoundary: value.showBoundary,
    boundary: copy(value.boundary), selection: copy(value.selection) };
}

export function publicLandMap(value) {
  const map = cleanLandMap(value);
  if (map && !map.showBoundary) map.boundary = [];
  return map;
}
