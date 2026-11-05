import { useEffect, useRef, useState } from "react";
import type { LandMap } from "../lib/landMap";
import type { MapRuntime } from "../lib/mapRuntime";
import { fetchGoogleMapsKey, onGoogleMapsFailure } from "../lib/googleMapsLoader";
import "../land-map.css";

type Props = { value: LandMap | null; editable?: boolean; onReady?: (runtime: MapRuntime) => void; onFailure?: () => void; onBasemapChange?: (basemap: LandMap["basemap"]) => void };

export default function LandMapCanvas({ value, editable = false, onReady, onFailure, onBasemapChange }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value); valueRef.current = value;
  const callbacks = useRef({ onReady, onFailure }); callbacks.current = { onReady, onFailure };
  const [runtime, setRuntime] = useState<MapRuntime | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [basemap, setBasemap] = useState(value?.basemap ?? "satellite");
  const initialFit = useRef(false);
  useEffect(() => { setBasemap(value?.basemap ?? "satellite"); }, [value?.basemap]);
  useEffect(() => {
    let cancelled = false, switching = false;
    let active: MapRuntime | undefined;
    const notify = (instance: MapRuntime) => {
      if (cancelled || (switching && instance.provider === "google")) { instance.destroy(); return; }
      active = instance; instance.setGeometry(valueRef.current, editable); instance.setBasemap(valueRef.current?.basemap ?? "satellite");
      if (valueRef.current?.selection.length) { instance.fit(); initialFit.current = true; }
      setRuntime(instance); callbacks.current.onReady?.(instance);
    };
    const fallback = async () => {
      if (cancelled || switching || !element.current) return;
      switching = true;
      active?.stopDrawing(); active?.stopEditing(); active?.destroy(); active = undefined;
      setRuntime(null); callbacks.current.onFailure?.();
      const { createLeafletMap } = await import("../lib/leafletMapRuntime");
      if (!cancelled && element.current) notify(await createLeafletMap(element.current, editable, () => {
        if (!cancelled) setWarning("Some map images could not load. Try the other map background or check your connection.");
      }));
    };
    function failed() { if (!cancelled) { setError("The map could not load. Refresh the page to try again."); callbacks.current.onFailure?.(); } }
    const removeFailureListener = onGoogleMapsFailure(() => {
      if (!cancelled) { setWarning("Google Maps is unavailable. An alternative map is shown."); void fallback().catch(failed); }
    });
    async function initialise() {
      try {
        const apiKey = await fetchGoogleMapsKey();
        if (cancelled || !element.current) return;
        if (apiKey) {
          try {
            const { createGoogleMap } = await import("../lib/googleMapRuntime");
            if (!cancelled && element.current) notify(await createGoogleMap(element.current, apiKey));
          } catch {
            if (!cancelled) { setWarning("Google Maps is unavailable. An alternative map is shown."); await fallback(); }
          }
        } else { if (!cancelled) setSetupNeeded(true); await fallback(); }
      } catch { failed(); }
    }
    void initialise();
    return () => { cancelled = true; removeFailureListener(); active?.destroy(); initialFit.current = false; };
  }, [editable]);
  const geometryKey = JSON.stringify({ selection: value?.selection ?? [], boundary: value?.boundary ?? [], show: value?.showBoundary });
  useEffect(() => {
    if (!runtime) return;
    runtime.setGeometry(valueRef.current, editable);
    if (!initialFit.current && valueRef.current?.selection.length) { runtime.fit(); initialFit.current = true; }
  }, [runtime, geometryKey, editable]);
  useEffect(() => { runtime?.setBasemap(basemap); }, [runtime, basemap]);

  return <div className={`land-map ${editable ? "land-map--editor" : "land-map--customer"}`} data-map-provider={runtime?.provider}>
    <div className="land-map__view-tools">
      <div role="group" aria-label="Map background">
        <button type="button" aria-pressed={basemap === "satellite"} onClick={() => { setBasemap("satellite"); onBasemapChange?.("satellite"); }}>{runtime?.provider === "google" ? "Satellite + labels" : "Satellite"}</button>
        <button type="button" aria-pressed={basemap === "street"} onClick={() => { setBasemap("street"); onBasemapChange?.("street"); }}>Street</button>
      </div>
      <button type="button" onClick={() => runtime?.fit()} disabled={!runtime || !value?.selection.length}>Show whole area</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {!runtime && !error && <p role="status">Loading land map…</p>}
    <div ref={element} tabIndex={0} className="land-map__canvas" role="region" aria-label={editable ? "Land map drawing canvas" : "Area Kingsvale is interested in"} />
    {warning && <p className="land-map__warning">{warning}</p>}
    {editable && setupNeeded && <p className="land-map__setup">Google Maps can be connected in Studio → Settings → Google Maps. The current map is available until setup is complete.</p>}
    <div className="land-map__legend"><span><i /> Area of interest</span>{(editable || value?.showBoundary) && !!value?.boundary.length && <span><i className="land-map__boundary-key" /> Imported boundary</span>}</div>
  </div>;
}
