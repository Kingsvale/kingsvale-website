import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type {} from "@geoman-io/leaflet-geoman-free";
import type { LandMap, LandPolygon } from "../lib/landMap";
import "../land-map.css";

export const selectionStyle = { color: "#ef4444", weight: 2.5, fillColor: "#ef4444", fillOpacity: 0.28 };
export type MapRuntime = {
  L: typeof Leaflet;
  map: Leaflet.Map;
  selection: Leaflet.FeatureGroup;
  boundary: Leaflet.FeatureGroup;
  fit: () => void;
};

export function readMapPolygons(group: Leaflet.FeatureGroup): LandPolygon[] {
  return group.getLayers().filter((layer): layer is Leaflet.Polygon => "toGeoJSON" in layer)
    .map((layer) => layer.toGeoJSON(false).geometry as LandPolygon);
}

type Props = {
  value: LandMap | null;
  editable?: boolean;
  onReady?: (runtime: MapRuntime) => void;
  onFailure?: () => void;
  prepareEditor?: () => Promise<void>;
  onBasemapChange?: (basemap: LandMap["basemap"]) => void;
};

export default function LandMapCanvas({ value, editable = false, onReady, onFailure, onBasemapChange, prepareEditor }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const callbacks = useRef({ onReady, onFailure, prepareEditor });
  callbacks.current = { onReady, onFailure, prepareEditor };
  const [runtime, setRuntime] = useState<MapRuntime | null>(null);
  const [error, setError] = useState("");
  const [tileError, setTileError] = useState(false);
  const [basemap, setBasemap] = useState(value?.basemap ?? "satellite");
  const initialFit = useRef(false);

  useEffect(() => { setBasemap(value?.basemap ?? "satellite"); }, [value?.basemap]);

  useEffect(() => {
    let cancelled = false;
    let activeMap: Leaflet.Map | undefined;
    let resize: ResizeObserver | undefined;
    async function initialise() {
      try {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        if (editable) {
          await callbacks.current.prepareEditor?.();
        }
        if (cancelled || !element.current) return;
        const map = L.map(element.current, { scrollWheelZoom: false, maxZoom: 21 }).setView([51.45, -0.85], 12);
        activeMap = map;
        const boundary = L.featureGroup().addTo(map);
        const selection = L.featureGroup().addTo(map);
        const fit = () => {
          const bounds = selection.getBounds().isValid() ? selection.getBounds() : boundary.getBounds();
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 19, animate: false });
        };
        const instance = { L, map, selection, boundary, fit };
        L.control.scale({ imperial: true, metric: true }).addTo(map);
        if (typeof ResizeObserver !== "undefined") {
          resize = new ResizeObserver(() => map.invalidateSize());
          resize.observe(element.current);
        }
        setRuntime(instance);
        callbacks.current.onReady?.(instance);
      } catch {
        if (!cancelled) { setError("The map could not load. Refresh the page to try again."); callbacks.current.onFailure?.(); }
      }
    }
    void initialise();
    return () => { cancelled = true; resize?.disconnect(); activeMap?.remove(); initialFit.current = false; };
  }, [editable]);

  useEffect(() => {
    if (!runtime) return;
    const { L, map } = runtime;
    setTileError(false);
    const tiles = basemap === "satellite"
      ? L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community',
        maxNativeZoom: 19, maxZoom: 21
      })
      : L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxNativeZoom: 19, maxZoom: 21
      });
    tiles.on("tileerror", () => setTileError(true));
    tiles.addTo(map);
    return () => { tiles.remove(); };
  }, [runtime, basemap]);

  const geometryKey = JSON.stringify({ selection: value?.selection ?? [], boundary: value?.boundary ?? [], show: value?.showBoundary });
  useEffect(() => {
    if (!runtime) return;
    const { L, selection, boundary } = runtime;
    const current = valueRef.current;
    const replace = (group: Leaflet.FeatureGroup, polygons: LandPolygon[], reference: boolean) => {
      if (JSON.stringify(readMapPolygons(group)) === JSON.stringify(polygons)) return;
      group.clearLayers();
      polygons.forEach((polygon) => {
        const latlngs = polygon.coordinates.map((ring) => ring.map(([lng, lat]) => L.latLng(lat, lng)));
        L.polygon(latlngs, reference
          ? { color: "#f9fafb", weight: 2, dashArray: "6 5", fill: false, pmIgnore: true, interactive: false }
          : { ...selectionStyle, pmIgnore: !editable }).addTo(group);
      });
    };
    replace(boundary, editable || current?.showBoundary ? current?.boundary ?? [] : [], true);
    replace(selection, current?.selection ?? [], false);
    if (!initialFit.current && current?.selection.length) { runtime.fit(); initialFit.current = true; }
  }, [runtime, geometryKey, editable]);

  return <div className={`land-map ${editable ? "land-map--editor" : "land-map--customer"}`}>
    <div className="land-map__view-tools">
      <div role="group" aria-label="Map background">
        <button type="button" aria-pressed={basemap === "satellite"} onClick={() => { setBasemap("satellite"); onBasemapChange?.("satellite"); }}>Satellite</button>
        <button type="button" aria-pressed={basemap === "street"} onClick={() => { setBasemap("street"); onBasemapChange?.("street"); }}>Street</button>
      </div>
      <button type="button" onClick={() => runtime?.fit()} disabled={!runtime || !value?.selection.length}>Show whole area</button>
    </div>
    {error ? <p role="alert">{error}</p> : <>
      {!runtime && <p role="status">Loading land map…</p>}
      <div ref={element} className="land-map__canvas" role="region" aria-label={editable ? "Land map drawing canvas" : "Area Kingsvale is interested in"} />
    </>}
    {tileError && <p className="land-map__warning" role="status">Some map images could not load. Try the other map background or check your connection.</p>}
    <div className="land-map__legend"><span><i /> Area of interest</span>{(editable || value?.showBoundary) && !!value?.boundary.length && <span><i className="land-map__boundary-key" /> Imported boundary</span>}</div>
  </div>;
}
