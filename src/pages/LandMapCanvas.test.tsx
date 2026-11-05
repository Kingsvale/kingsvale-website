import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LandMap } from "../lib/landMap";

const mocks = vi.hoisted(() => ({ key: vi.fn(), google: vi.fn(), leaflet: vi.fn(), failure: undefined as (() => void) | undefined }));
vi.mock("../lib/googleMapsLoader", () => ({ fetchGoogleMapsKey: mocks.key, onGoogleMapsFailure: (callback: () => void) => { mocks.failure = callback; return () => { mocks.failure = undefined; }; } }));
vi.mock("../lib/googleMapRuntime", () => ({ createGoogleMap: mocks.google }));
vi.mock("../lib/leafletMapRuntime", () => ({ createLeafletMap: mocks.leaflet }));
import LandMapCanvas from "./LandMapCanvas";

const value: LandMap = { version: 1, basemap: "satellite", showBoundary: false, boundary: [], selection: [{ type: "Polygon", coordinates: [[[0, 51], [1, 51], [1, 52], [0, 51]]] }] };
const runtime = (provider: "google" | "leaflet") => ({ provider, setGeometry: vi.fn(), readSelection: vi.fn(), fit: vi.fn(), locate: vi.fn(), setBasemap: vi.fn(), startDrawing: vi.fn(), stopDrawing: vi.fn(), edit: vi.fn(), stopEditing: vi.fn(), restore: vi.fn(), destroy: vi.fn() });
beforeEach(() => { vi.clearAllMocks(); mocks.key.mockResolvedValue("test-key"); });
afterEach(cleanup);

it("uses Google on customer QR pages and passes subsequent saved selections to the same viewer", async () => {
  const google = runtime("google"); mocks.google.mockResolvedValue(google);
  const { rerender } = render(<LandMapCanvas value={value} />);
  await screen.findByRole("button", { name: "Satellite + labels" });
  expect(google.setGeometry).toHaveBeenCalledWith(value, false);
  const next = { ...value, selection: [{ ...value.selection[0], coordinates: [[[0, 51], [2, 51], [2, 52], [0, 51]] as [number, number][]] }] };
  rerender(<LandMapCanvas value={next} />);
  await waitFor(() => expect(google.setGeometry).toHaveBeenCalledWith(next, false));
  expect(mocks.google).toHaveBeenCalledOnce();
  expect(mocks.leaflet).not.toHaveBeenCalled();
});

it("keeps customer geometry available when Google authorization fails after loading", async () => {
  const google = runtime("google"), leaflet = runtime("leaflet");
  mocks.google.mockResolvedValue(google); mocks.leaflet.mockResolvedValue(leaflet);
  render(<LandMapCanvas value={value} />);
  await screen.findByRole("button", { name: "Satellite + labels" });
  mocks.failure?.();
  await screen.findByText(/alternative map is shown/);
  await waitFor(() => expect(leaflet.setGeometry).toHaveBeenCalledWith(value, false));
  expect(google.destroy).toHaveBeenCalledOnce();
});

it("requires no Google request until a key is configured and shows setup guidance only in Studio", async () => {
  mocks.key.mockResolvedValue(""); mocks.leaflet.mockResolvedValue(runtime("leaflet"));
  const { rerender } = render(<LandMapCanvas value={value} />);
  await screen.findByRole("button", { name: "Show whole area" });
  await waitFor(() => expect(mocks.leaflet).toHaveBeenCalledOnce());
  expect(screen.queryByText(/Google Maps can be connected/)).toBeNull();
  rerender(<LandMapCanvas value={value} editable />);
  await screen.findByText(/Google Maps can be connected/);
  expect(mocks.google).not.toHaveBeenCalled();
});
