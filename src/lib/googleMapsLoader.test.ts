import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((script) => script.remove()); });

describe("Google Maps loading", () => {
  it("reuses one API script across multiple map mounts and reports authentication failures", async () => {
    vi.resetModules();
    const { loadGoogleMaps, onGoogleMapsFailure } = await import("./googleMapsLoader");
    const failed = vi.fn(), unsubscribe = onGoogleMapsFailure(failed);
    const first = loadGoogleMaps("synthetic-browser-key"), second = loadGoogleMaps("synthetic-browser-key");
    expect(first).toBe(second);
    expect(document.querySelectorAll('script[src*="maps.googleapis.com"]')).toHaveLength(1);
    const host = window as Window & { gm_authFailure?: () => void };
    host.gm_authFailure?.();
    await expect(first).rejects.toThrow(/authorize/);
    expect(failed).toHaveBeenCalledOnce(); unsubscribe();
  });

  it("exposes a load failure instead of leaving the map waiting forever", async () => {
    vi.resetModules();
    const { loadGoogleMaps } = await import("./googleMapsLoader");
    const request = loadGoogleMaps("synthetic-browser-key");
    document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]')!.dispatchEvent(new Event("error"));
    await expect(request).rejects.toThrow(/could not load/);
  });

  it("reads only the public browser key from runtime configuration", async () => {
    const { fetchGoogleMapsKey } = await import("./googleMapsLoader");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ apiKey: "test-browser-key", privateSettings: "not used" }), { headers: { "content-type": "application/json" } }));
    expect(await fetchGoogleMapsKey()).toBe("test-browser-key");
    expect(fetch).toHaveBeenCalledWith("/api/maps/config", expect.objectContaining({ cache: "no-store" }));
  });
});
