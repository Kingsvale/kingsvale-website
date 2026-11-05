import { describe, expect, it, vi } from "vitest";
import type { LandMap, LandPolygon } from "./landMap";
import { createGoogleMap } from "./googleMapRuntime";

class Events {
  listeners: Record<string, ((event?: any) => void)[]> = {};
  addListener(name: string, callback: (event?: any) => void) {
    (this.listeners[name] ??= []).push(callback);
    return { remove: () => { this.listeners[name] = this.listeners[name].filter((item) => item !== callback); } };
  }
  emit(name: string, event?: unknown) { [...(this.listeners[name] ?? [])].forEach((callback) => callback(event)); }
}
class Point {
  constructor(public value: { lat: number; lng: number }) {}
  lat() { return this.value.lat; }
  lng() { return this.value.lng; }
}
class ArrayValue<T> {
  constructor(public items: T[]) {}
  getArray() { return this.items; }
  getAt(i: number) { return this.items[i]; }
  getLength() { return this.items.length; }
  removeAt(i: number) { this.items.splice(i, 1); }
}
class FakeMap extends Events {
  static current: FakeMap;
  type = ""; zoom = 18;
  constructor(_element: HTMLElement, public options: any) { super(); FakeMap.current = this; }
  setOptions(next: any) { Object.assign(this.options, next); }
  setMapTypeId(type: string) { this.type = type; }
  setCenter() {}
  setZoom(zoom: number) { this.zoom = zoom; }
  getZoom() { return this.zoom; }
  fitBounds() {}
  getProjection() { return { fromLatLngToPoint: (p: Point) => ({ x: p.lng(), y: p.lat() }) }; }
}
class FakePolygon extends Events {
  static all: FakePolygon[] = [];
  paths: ArrayValue<ArrayValue<Point>>;
  constructor(public options: any) { super(); this.paths = new ArrayValue((options.paths ?? []).map((path: any[]) => new ArrayValue(path.map((p) => new Point(p))))); FakePolygon.all.push(this); }
  getPaths() { return this.paths; }
  setPath(points: any[]) { this.paths = new ArrayValue([new ArrayValue(points.map((p) => new Point(p)))]); }
  setMap(map: unknown) { this.options.map = map; }
  setOptions(next: any) { Object.assign(this.options, next); }
}
class FakeCircle extends Events {
  static current: FakeCircle;
  constructor(public options: any) { super(); FakeCircle.current = this; }
  setMap(map: unknown) { this.options.map = map; }
}
vi.mock("./googleMapsLoader", () => ({ loadGoogleMaps: async () => ({
  Map: FakeMap, Polygon: FakePolygon, Circle: FakeCircle, LatLng: Point,
  LatLngBounds: class { extend() {} },
  event: { clearInstanceListeners: (target: Events) => { target.listeners = {}; }, addListenerOnce: () => {}, trigger: () => {} }
}) }));

const polygon: LandPolygon = { type: "Polygon", coordinates: [
  [[0, 51], [1, 51], [1, 52], [0, 52], [0, 51]],
  [[0.2, 51.2], [0.4, 51.2], [0.4, 51.4], [0.2, 51.4], [0.2, 51.2]]
] };
const value: LandMap = { version: 1, basemap: "satellite", showBoundary: false, boundary: [polygon], selection: [polygon] };

describe("Google land map runtime", () => {
  it("preserves imported coordinates and holes, supplies view-only overlays, and switches map types", async () => {
    const runtime = await createGoogleMap(document.createElement("div"), "synthetic-key");
    runtime.setGeometry(value, false);
    expect(runtime.readSelection()).toEqual(value.selection);
    const visible = FakePolygon.all.filter((p) => p.options.map === FakeMap.current);
    expect(visible).toHaveLength(1);
    expect(visible[0].options.clickable).toBe(false);
    runtime.setBasemap("satellite"); expect(FakeMap.current.type).toBe("hybrid");
    runtime.setBasemap("street"); expect(FakeMap.current.type).toBe("roadmap");
    runtime.setGeometry({ ...value, showBoundary: true }, false);
    expect(FakePolygon.all.filter((p) => p.options.map === FakeMap.current)).toHaveLength(2);
    runtime.destroy();
    expect(FakePolygon.all.filter((p) => p.options.map === FakeMap.current)).toHaveLength(0);
  });

  it("finishes a drawn area as a closed polygon and cancels without changing saved geometry", async () => {
    const runtime = await createGoogleMap(document.createElement("div"), "synthetic-key");
    runtime.setGeometry(value, true);
    const complete = vi.fn(), end = vi.fn();
    runtime.startDrawing(complete, end);
    for (const [lng, lat] of [[0, 51], [1, 51], [1, 52]]) FakeMap.current.emit("click", { latLng: new Point({ lng, lat }) });
    FakeCircle.current.emit("click");
    expect(complete).toHaveBeenCalledWith({ type: "Polygon", coordinates: [[[0, 51], [1, 51], [1, 52], [0, 51]]] });
    expect(end).toHaveBeenCalledOnce();
    expect(runtime.readSelection()).toEqual(value.selection);
    runtime.startDrawing(complete, end); runtime.stopDrawing();
    expect(complete).toHaveBeenCalledOnce();
    runtime.destroy();
  });

  it("deletes corners only while editing, retains three vertices, and restores cancelled edits", async () => {
    const runtime = await createGoogleMap(document.createElement("div"), "synthetic-key");
    runtime.setGeometry(value, true);
    const overlay = FakePolygon.all.filter((p) => p.options.map === FakeMap.current && p.options.zIndex === 2)[0];
    overlay.emit("click", { path: 0, vertex: 1 });
    expect(runtime.readSelection()).toEqual(value.selection);
    runtime.edit(true); overlay.emit("click", { path: 0, vertex: 1 });
    expect(runtime.readSelection()[0].coordinates[0]).toHaveLength(4);
    overlay.emit("click", { path: 0, vertex: 1 });
    expect(runtime.readSelection()[0].coordinates[0]).toHaveLength(4);
    runtime.stopEditing(); runtime.restore(value.selection);
    expect(runtime.readSelection()).toEqual(value.selection);
    runtime.destroy();
  });
});
