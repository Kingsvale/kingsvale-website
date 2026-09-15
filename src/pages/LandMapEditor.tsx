import { useEffect, useRef, useState } from "react";
import { MapPin, Pencil, Upload, Undo2 } from "lucide-react";
import type { Polygon } from "leaflet";
import { parseKml, MAX_KML_BYTES } from "../lib/kmlImport";
import { validateLandMap, type LandMap } from "../lib/landMap";
import LandMapCanvas, { readMapPolygons, selectionStyle, type MapRuntime } from "./LandMapCanvas";

type Props = {
  value: LandMap | null;
  postcode: string;
  disabled: boolean;
  onChange: (map: LandMap | null) => void;
  onBusyChange: (busy: boolean) => void;
  onSave: () => void;
  canSave: boolean;
  savedAt: string;
};

async function prepareEditor() {
  await import("@geoman-io/leaflet-geoman-free");
  await import("@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css");
}

export default function LandMapEditor({ value, postcode, disabled, onChange, onBusyChange, onSave, canSave, savedAt }: Props) {
  const [runtime, setRuntime] = useState<MapRuntime | null>(null);
  const [mode, setMode] = useState<"browse" | "draw" | "edit">("browse");
  const [deletingPoints, setDeletingPoints] = useState(false);
  const [search, setSearch] = useState(postcode === "AA1 1AA" ? "" : postcode);
  const [locating, setLocating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<(LandMap | null)[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const current = useRef(value);
  current.current = value;
  const callbacks = useRef({ onChange, onBusyChange });
  callbacks.current = { onChange, onBusyChange };
  const drawIntent = useRef<"add" | "replace">("add");
  const alive = useRef(true);
  const lookup = useRef<AbortController | null>(null);
  const editingSnapshot = useRef<LandMap | null>(null);
  const blocked = disabled || importing;
  const previousSave = useRef(savedAt);

  useEffect(() => {
    if (previousSave.current !== savedAt) {
      previousSave.current = savedAt;
      setMessage("Saved. The existing QR link now opens this land map.");
    }
  }, [savedAt]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; lookup.current?.abort(); callbacks.current.onBusyChange(false); };
  }, []);

  function commit(next: LandMap | null, note = "Area updated. Save the site to update the customer’s QR page.") {
    const previous = structuredClone(current.current);
    setHistory((items) => [...items.slice(-19), previous]);
    current.current = next;
    callbacks.current.onChange(next);
    setError("");
    setMessage(note);
  }

  function stopTools() {
    runtime?.map.pm.disableDraw();
    runtime?.map.pm.disableGlobalEditMode();
    setMode("browse");
    setDeletingPoints(false);
    callbacks.current.onBusyChange(false);
  }

  function ready(instance: MapRuntime) {
    setRuntime(instance);
    instance.map.pm.setGlobalOptions({ allowSelfIntersection: false, snappable: true, layerGroup: instance.selection, pathOptions: selectionStyle });
    instance.map.on("pm:drawstart", () => { setMode("draw"); callbacks.current.onBusyChange(true); });
    instance.map.on("pm:drawend", () => { setMode("browse"); callbacks.current.onBusyChange(false); });
    instance.map.on("pm:create", (event) => {
      const layer = event.layer as Polygon;
      const geometry = layer.toGeoJSON(false).geometry;
      if (geometry.type !== "Polygon") return;
      const previous = current.current;
      const next: LandMap = {
        version: 1, basemap: previous?.basemap ?? "satellite", showBoundary: previous?.showBoundary ?? false,
        boundary: previous?.boundary ?? [],
        selection: drawIntent.current === "replace" ? [geometry as LandMap["selection"][number]] : [...(previous?.selection ?? []), geometry as LandMap["selection"][number]]
      };
      const problem = validateLandMap(next);
      if (problem) { instance.selection.removeLayer(layer); setError(problem); return; }
      commit(next);
    });
  }

  function startDraw(intent: "add" | "replace") {
    stopTools();
    drawIntent.current = intent;
    setError("");
    runtime?.map.pm.enableDraw("Polygon", { allowSelfIntersection: false, pathOptions: selectionStyle });
  }

  function editArea() {
    if (mode === "edit") {
      const polygons = runtime ? readMapPolygons(runtime.selection) : [];
      const next = current.current ? { ...current.current, selection: polygons } : null;
      const problem = validateLandMap(next);
      if (problem) { setError(problem); return; }
      stopTools();
      if (JSON.stringify(next) !== JSON.stringify(editingSnapshot.current)) commit(next);
      return;
    }
    stopTools();
    editingSnapshot.current = structuredClone(current.current);
    configureCorners(false);
    setMode("edit");
    callbacks.current.onBusyChange(true);
  }

  function configureCorners(remove: boolean) {
    runtime?.map.pm.disableGlobalEditMode();
    runtime?.map.pm.enableGlobalEditMode({ allowSelfIntersection: false, snappable: true, removeLayerBelowMinVertexCount: false,
      removeVertexOn: remove ? "click" : "contextmenu", hideMiddleMarkers: remove, moveVertexValidation: () => !remove });
    setDeletingPoints(remove);
  }

  function deletePoints() {
    if (mode !== "edit") editingSnapshot.current = structuredClone(current.current);
    configureCorners(!deletingPoints);
    setMode("edit");
    setError("");
    callbacks.current.onBusyChange(true);
  }

  function cancelEditing() {
    if (mode === "edit" && runtime) {
      stopTools();
      runtime.selection.getLayers().forEach((layer, index) => {
        const polygon = editingSnapshot.current?.selection[index];
        if (polygon) (layer as Polygon).setLatLngs(polygon.coordinates.map((ring) => ring.map(([lng, lat]) => runtime.L.latLng(lat, lng))));
      });
    } else stopTools();
  }

  async function importFile(file?: File) {
    if (!file || blocked || mode !== "browse") return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".kml")) { setError("Choose a .kml file exported from your land search tool."); return; }
    if (file.size > MAX_KML_BYTES) { setError("Choose a KML file smaller than 5 MB."); return; }
    setImporting(true);
    callbacks.current.onBusyChange(true);
    try {
      const imported = parseKml(await file.text());
      if (!alive.current) return;
      commit(imported.map, `Imported ${imported.map.selection.length} ${imported.map.selection.length === 1 ? "area" : "areas"}${imported.titleNumber ? ` (${imported.titleNumber})` : ""}. Red fill applied. Save the site to update its QR page.`);
      // Fit the new coordinates immediately, independently of the render cycle.
      if (runtime) {
        const points = imported.map.selection.flatMap((polygon) => polygon.coordinates[0].map(([lng, lat]) => runtime.L.latLng(lat, lng)));
        runtime.map.fitBounds(runtime.L.latLngBounds(points), { padding: [35, 35], maxZoom: 19, animate: false });
      }
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "The KML could not be imported.");
    } finally {
      if (alive.current) { setImporting(false); callbacks.current.onBusyChange(false); }
    }
  }

  async function locate() {
    const normalized = search.trim().toUpperCase();
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(normalized)) { setError("Enter a full UK postcode, such as RG10 9TL."); return; }
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setLocating(true); setError("");
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(normalized)}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !Number.isFinite(data.result?.latitude) || !Number.isFinite(data.result?.longitude)) throw new Error("Postcode not found. Check it and try again.");
      if (alive.current) runtime?.map.setView([data.result.latitude, data.result.longitude], 18);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "Postcode search is unavailable. Try again, or pan and zoom the map.");
    } finally { clearTimeout(timeout); if (alive.current) setLocating(false); }
  }

  const activeTool = mode !== "browse";
  return <section className="admin-panel land-map-editor" aria-labelledby="land-map-editor-title">
    <div className="land-map-editor__heading"><div><p className="eyebrow">Customer QR page</p><h2 id="land-map-editor-title">Land map</h2></div><span className="land-map-editor__badge">Red fill applied automatically</span></div>
    <p>Upload a plot boundary or draw the land you’re interested in. Saving the site updates its existing QR page.</p>
    <div className="land-map-editor__upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void importFile(event.dataTransfer.files[0]); }}>
      <Upload aria-hidden="true" />
      <div><strong>Drop a KML file here</strong><small>Up to 5 MB. The imported outline stays available as a guide.</small></div>
      <button type="button" className="admin-ghost" disabled={blocked || activeTool} onClick={() => fileInput.current?.click()}>{importing ? "Importing…" : "Upload KML"}</button>
      <input ref={fileInput} type="file" accept=".kml,application/vnd.google-earth.kml+xml" aria-label="Upload plot KML" hidden onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    <div className="land-map-editor__search">
      <label htmlFor="land-map-postcode">Find a postcode</label>
      <div><input id="land-map-postcode" value={search} placeholder="e.g. RG10 9TL" maxLength={12} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void locate(); } }} />
        <button type="button" className="admin-ghost" disabled={!runtime || locating || activeTool || blocked} onClick={() => void locate()}><MapPin aria-hidden="true" />{locating ? "Finding…" : "Find"}</button></div>
    </div>
    <div className="land-map-editor__tools" role="group" aria-label="Land drawing tools">
      <button type="button" className="admin-ghost" disabled={!runtime || blocked || activeTool} onClick={() => startDraw("add")}><Pencil aria-hidden="true" />{value?.selection.length ? "Add another area" : "Draw area"}</button>
      {!!value?.selection.length && <button type="button" className="admin-ghost" disabled={!runtime || blocked || activeTool} onClick={() => startDraw("replace")}>Draw a replacement area</button>}
      <button type="button" className="admin-ghost" disabled={!runtime || blocked || !value?.selection.length || mode === "draw"} aria-pressed={mode === "edit"} onClick={editArea}>{mode === "edit" ? "Finish editing" : "Edit corners"}</button>
      <button type="button" className="admin-ghost" disabled={!runtime || blocked || !value?.selection.length || mode === "draw"} aria-pressed={deletingPoints} onClick={deletePoints}>{deletingPoints ? "Move corners instead" : "Delete points"}</button>
      {activeTool && <button type="button" className="admin-ghost" onClick={cancelEditing}>Cancel {mode === "draw" ? "drawing" : "editing"}</button>}
      <button type="button" className="admin-ghost" disabled={blocked || activeTool || !history.length} onClick={() => {
        const previous = history[history.length - 1]; setHistory((items) => items.slice(0, -1)); current.current = previous; onChange(previous); setError(""); setMessage("Last map change undone. Save the site to update its QR page.");
      }}><Undo2 aria-hidden="true" />Undo</button>
    </div>
    <p className="land-map-editor__hint">{mode === "draw" ? "Click or tap each corner, then the first corner to finish. Pan the map to move around." : deletingPoints ? "Click or tap a white corner point to delete it. Each area must keep at least three corners. Choose Finish editing to apply, or Cancel editing to restore the shape." : mode === "edit" ? "Drag the corner handles to adjust the area. Drag a midpoint to add a corner. Choose Delete points to remove corners, then Finish editing." : "Use + and − to zoom. Drag the map to move around. Edit corners or Delete points to refine an imported plot."}</p>
    <LandMapCanvas value={value} editable prepareEditor={prepareEditor} onReady={ready} onFailure={() => onBusyChange(false)} onBasemapChange={(basemap) => { if (current.current && !activeTool && !blocked) commit({ ...current.current, basemap }); }} />
    {!!value?.selection.length && <div className="land-map-editor__areas">{value.selection.map((_, index) => <span key={index}>Area {index + 1}<button type="button" disabled={blocked || activeTool} aria-label={`Remove area ${index + 1}`} onClick={() => {
      const selection = value.selection.filter((__, i) => i !== index); commit(selection.length ? { ...value, selection } : null);
    }}>Remove</button></span>)}</div>}
    {!!value?.boundary.length && <div className="land-map-editor__options">
      <button type="button" className="admin-ghost" disabled={blocked || activeTool} onClick={() => commit({ ...value, selection: structuredClone(value.boundary) })}>Use whole imported plot</button>
      <label><input type="checkbox" checked={value.showBoundary} disabled={blocked || activeTool} onChange={(event) => commit({ ...value, showBoundary: event.target.checked })} /> Show the original boundary on the customer page</label>
    </div>}
    {error && <p className="land-map-editor__error" role="alert">{error}</p>}
    {message && <p className="land-map-editor__message" role="status">{message}</p>}
    <div className="land-map-editor__options"><button type="button" className="admin-save" disabled={!canSave || blocked || activeTool} onClick={onSave}>Save map to QR page</button><p className="land-map-editor__hint">Saves the site details too. Printed QR codes keep the same link.</p></div>
  </section>;
}
