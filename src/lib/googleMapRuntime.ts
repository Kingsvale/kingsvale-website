/// <reference types="google.maps" />
import type { LandPolygon, MapPosition } from "./landMap";
import type { MapRuntime } from "./mapRuntime";
import { loadGoogleMaps } from "./googleMapsLoader";

const red = { strokeColor: "#ef4444", strokeWeight: 2.5, strokeOpacity: 1, fillColor: "#ef4444", fillOpacity: 0.28 };
const signedArea = (ring: MapPosition[]) => ring.reduce((sum, p, i) => { const next = ring[(i + 1) % ring.length]; return sum + p[0] * next[1] - next[0] * p[1]; }, 0);

export async function createGoogleMap(element: HTMLElement, apiKey: string): Promise<MapRuntime> {
  const maps = await loadGoogleMaps(apiKey);
  const map = new maps.Map(element, { center: { lat: 51.45, lng: -0.85 }, zoom: 12, mapTypeId: "hybrid", tilt: 0, heading: 0,
    streetViewControl: false, mapTypeControl: false, rotateControl: false, fullscreenControl: true, scrollwheel: false, gestureHandling: "cooperative" });
  type Shape = { overlay: google.maps.Polygon; reversed: boolean[] };
  let selected: Shape[] = [], references: google.maps.Polygon[] = [];
  let drawing: google.maps.Polygon | undefined, firstCorner: google.maps.Circle | undefined;
  let drawListeners: google.maps.MapsEventListener[] = [];
  let onEnd: (() => void) | undefined;
  let drawPoints: MapPosition[] = [];
  let editing = false, removing = false, disposed = false;
  let selectionKey = "", boundaryKey = "";
  const toLatLng = ([lng, lat]: MapPosition) => ({ lng, lat });
  function shape(polygon: LandPolygon, reference = false): Shape {
    const direction = Math.sign(signedArea(polygon.coordinates[0]));
    const reversed = polygon.coordinates.map((ring, i) => i > 0 && Math.sign(signedArea(ring)) === direction);
    const paths = polygon.coordinates.map((ring, i) => { const open = ring.slice(0, -1); return (reversed[i] ? open.reverse() : open).map(toLatLng); });
    const overlay = new maps.Polygon({ map, paths, ...(reference ? { strokeColor: "#ffffff", strokeWeight: 2, strokeOpacity: 0.85, fillOpacity: 0, zIndex: 1 } : { ...red, zIndex: 2 }), clickable: false });
    if (!reference) {
      const removeVertex = (event: google.maps.PolyMouseEvent) => {
        if (!editing || event.vertex == null || event.path == null) return;
        const path = overlay.getPaths().getAt(event.path);
        if (path.getLength() > 3) path.removeAt(event.vertex);
      };
      overlay.addListener("click", (event: google.maps.PolyMouseEvent) => { if (removing) removeVertex(event); });
      overlay.addListener("contextmenu", removeVertex);
    }
    return { overlay, reversed };
  }
  function readSelection(): LandPolygon[] {
    return selected.map(({ overlay, reversed }) => ({ type: "Polygon", coordinates: overlay.getPaths().getArray().map((path, i) => {
      const points = path.getArray().map((point) => [point.lng(), point.lat()] as MapPosition);
      if (reversed[i]) points.reverse();
      if (points.length) points.push([...points[0]]);
      return points;
    }) }));
  }
  function stopDrawing() {
    drawListeners.forEach((listener) => listener.remove()); drawListeners = [];
    drawing?.setMap(null); firstCorner?.setMap(null); drawing = undefined; firstCorner = undefined; drawPoints = [];
    element.removeEventListener("keydown", escapeDrawing);
    map.setOptions({ draggableCursor: null, disableDoubleClickZoom: false });
    const done = onEnd; onEnd = undefined; done?.();
  }
  function escapeDrawing(event: KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); stopDrawing(); } }
  function restore(polygons: LandPolygon[]) {
    selected.forEach(({ overlay }) => { maps.event.clearInstanceListeners(overlay); overlay.setMap(null); });
    selected = polygons.map((polygon) => shape(polygon)); selectionKey = JSON.stringify(polygons);
  }
  function stopEditing() { editing = false; removing = false; selected.forEach(({ overlay }) => overlay.setOptions({ editable: false, clickable: false })); }
  function fit(polygons?: LandPolygon[]) {
    const points = polygons?.flatMap((p) => p.coordinates[0]) ?? readSelection().flatMap((p) => p.coordinates[0]);
    if (!points.length) return;
    const bounds = new maps.LatLngBounds(); points.forEach((p) => bounds.extend(toLatLng(p))); map.fitBounds(bounds, 35);
    maps.event.addListenerOnce(map, "idle", () => { if (!disposed && (map.getZoom() ?? 0) > 20) map.setZoom(20); });
  }
  const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { maps.event.trigger(map, "resize"); }) : undefined;
  resize?.observe(element);
  return {
    provider: "google",
    setGeometry(value, editable) {
      const polygons = value?.selection ?? [], nextSelection = JSON.stringify(polygons);
      if (nextSelection !== selectionKey) restore(polygons);
      const boundary = editable || value?.showBoundary ? value?.boundary ?? [] : [], nextBoundary = JSON.stringify(boundary);
      if (nextBoundary !== boundaryKey) { references.forEach((p) => p.setMap(null)); references = boundary.map((p) => shape(p, true).overlay); boundaryKey = nextBoundary; }
    },
    readSelection, fit,
    locate(lat, lng, zoom) { map.setCenter({ lat, lng }); map.setZoom(zoom); },
    setBasemap(basemap) { map.setMapTypeId(basemap === "satellite" ? "hybrid" : "roadmap"); },
    startDrawing(complete, end) {
      stopEditing(); stopDrawing(); onEnd = end;
      drawing = new maps.Polygon({ map, paths: [], ...red, fillOpacity: 0.18, clickable: false, zIndex: 3 });
      map.setOptions({ draggableCursor: "crosshair", disableDoubleClickZoom: true });
      const finish = () => {
        if (drawPoints.length < 3) return;
        const polygon: LandPolygon = { type: "Polygon", coordinates: [[...drawPoints.map((p) => [...p] as MapPosition), [...drawPoints[0]]]] };
        stopDrawing(); complete(polygon);
      };
      drawListeners.push(map.addListener("click", (event: google.maps.MapMouseEvent) => {
        if (!event.latLng) return;
        const point: MapPosition = [event.latLng.lng(), event.latLng.lat()];
        if (drawPoints.length >= 3) {
          const projection = map.getProjection(), scale = 2 ** (map.getZoom() ?? 18);
          const first = projection?.fromLatLngToPoint(new maps.LatLng(toLatLng(drawPoints[0]))), next = projection?.fromLatLngToPoint(event.latLng);
          if (first && next && Math.hypot(first.x - next.x, first.y - next.y) * scale < 15) { finish(); return; }
        }
        drawPoints.push(point); drawing?.setPath(drawPoints.map(toLatLng));
        if (drawPoints.length === 1) {
          firstCorner = new maps.Circle({ map, center: toLatLng(point), radius: Math.max(0.3, 6 * 156543.03392 * Math.cos(point[1] * Math.PI / 180) / 2 ** (map.getZoom() ?? 18)),
            strokeColor: "#9e1c1c", strokeWeight: 2, fillColor: "#ffffff", fillOpacity: 1, zIndex: 4 });
          drawListeners.push(firstCorner.addListener("click", finish));
        }
      }));
      element.addEventListener("keydown", escapeDrawing); element.focus();
    },
    stopDrawing,
    edit(remove) { editing = true; removing = remove; selected.forEach(({ overlay }) => overlay.setOptions({ editable: true, clickable: true })); },
    stopEditing, restore,
    destroy() {
      disposed = true; stopDrawing(); stopEditing(); resize?.disconnect();
      selected.forEach(({ overlay }) => { maps.event.clearInstanceListeners(overlay); overlay.setMap(null); });
      references.forEach((p) => p.setMap(null)); maps.event.clearInstanceListeners(map); element.replaceChildren();
    }
  };
}
