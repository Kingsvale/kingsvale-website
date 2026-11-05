import type { LandPolygon } from "./landMap";
import type { MapRuntime } from "./mapRuntime";
import { selectionStyle } from "./mapRuntime";
import type {} from "@geoman-io/leaflet-geoman-free";

export async function createLeafletMap(element: HTMLElement, editable: boolean, tileFailure: () => void): Promise<MapRuntime> {
  const L = await import("leaflet");
  await import("leaflet/dist/leaflet.css");
  if (editable) {
    await import("@geoman-io/leaflet-geoman-free");
    await import("@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css");
  }
  const map = L.map(element, { scrollWheelZoom: false, maxZoom: 21 }).setView([51.45, -0.85], 12);
  const boundary = L.featureGroup().addTo(map), selection = L.featureGroup().addTo(map);
  let tiles: import("leaflet").TileLayer | undefined;
  let onComplete: ((polygon: LandPolygon) => boolean | void) | undefined;
  let onEnd: (() => void) | undefined;
  const read = (group: import("leaflet").FeatureGroup) => group.getLayers().map((layer) => (layer as import("leaflet").Polygon).toGeoJSON(false).geometry as LandPolygon);
  function replace(group: import("leaflet").FeatureGroup, polygons: LandPolygon[], reference: boolean) {
    if (JSON.stringify(read(group)) === JSON.stringify(polygons)) return;
    group.clearLayers();
    for (const polygon of polygons) L.polygon(polygon.coordinates.map((ring) => ring.map(([lng, lat]) => L.latLng(lat, lng))), reference
      ? { color: "#f9fafb", weight: 2, dashArray: "6 5", fill: false, pmIgnore: true, interactive: false }
      : { ...selectionStyle, pmIgnore: !editable }).addTo(group);
  }
  if (editable) {
    map.pm.setGlobalOptions({ allowSelfIntersection: false, snappable: true, layerGroup: selection, pathOptions: selectionStyle });
    map.on("pm:drawend", () => onEnd?.());
    map.on("pm:create", (event) => {
      const layer = event.layer as import("leaflet").Polygon;
      const polygon = layer.toGeoJSON(false).geometry;
      if (polygon.type === "Polygon" && onComplete?.(polygon as LandPolygon) === false) selection.removeLayer(layer);
    });
  }
  L.control.scale({ imperial: true, metric: true }).addTo(map);
  const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize()) : undefined;
  resize?.observe(element);
  return {
    provider: "leaflet",
    setGeometry(value, editing) { replace(boundary, editing || value?.showBoundary ? value?.boundary ?? [] : [], true); replace(selection, value?.selection ?? [], false); },
    readSelection: () => read(selection),
    fit(polygons) {
      const bounds = polygons ? L.latLngBounds(polygons.flatMap((p) => p.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng))))
        : selection.getBounds().isValid() ? selection.getBounds() : boundary.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 19, animate: false });
    },
    locate: (lat, lng, zoom) => { map.setView([lat, lng], zoom); },
    setBasemap(basemap) {
      tiles?.remove();
      tiles = basemap === "satellite" ? L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community', maxNativeZoom: 19, maxZoom: 21
      }) : L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxNativeZoom: 19, maxZoom: 21
      });
      tiles.on("tileerror", tileFailure).addTo(map);
    },
    startDrawing(complete, end) { onComplete = complete; onEnd = end; map.pm.enableDraw("Polygon", { allowSelfIntersection: false, pathOptions: selectionStyle }); },
    stopDrawing() { if (editable) map.pm.disableDraw(); },
    edit(remove) { map.pm.disableGlobalEditMode(); map.pm.enableGlobalEditMode({ allowSelfIntersection: false, snappable: true, removeLayerBelowMinVertexCount: false,
      removeVertexOn: remove ? "click" : "contextmenu", hideMiddleMarkers: remove, moveVertexValidation: () => !remove }); },
    stopEditing() { if (editable) map.pm.disableGlobalEditMode(); },
    restore(polygons) { replace(selection, polygons, false); },
    destroy() { resize?.disconnect(); map.remove(); }
  };
}
