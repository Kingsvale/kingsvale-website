/// <reference types="google.maps" />

let loading: Promise<typeof google.maps> | undefined;
let loadedKey = "";
const failures = new Set<() => void>();
type GoogleWindow = Window & { google?: typeof google; gm_authFailure?: () => void; kingsvaleGoogleMapsReady?: () => void };

export function onGoogleMapsFailure(callback: () => void) {
  failures.add(callback);
  return () => { failures.delete(callback); };
}

// One script per document, even when React mounts an editor and a preview together.
export function loadGoogleMaps(apiKey: string): Promise<typeof google.maps> {
  if (loadedKey && loadedKey !== apiKey) return Promise.reject(new Error("Refresh the page to use the new Google Maps key."));
  if (loading) return loading;
  loadedKey = apiKey;
  loading = new Promise((resolve, reject) => {
    const host = window as GoogleWindow;
    const script = document.createElement("script");
    const previousAuthFailure = host.gm_authFailure;
    host.gm_authFailure = () => { clearTimeout(timeout); script.remove(); previousAuthFailure?.(); reject(new Error("Google Maps could not authorize this website.")); failures.forEach((callback) => callback()); };
    const timeout = setTimeout(() => { script.remove(); reject(new Error("Google Maps took too long to load.")); }, 15000);
    const fail = () => { clearTimeout(timeout); script.remove(); reject(new Error("Google Maps could not load.")); };
    host.kingsvaleGoogleMapsReady = () => {
      clearTimeout(timeout);
      if (!host.google?.maps) { fail(); return; }
      resolve(host.google.maps);
    };
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key: apiKey, callback: "kingsvaleGoogleMapsReady", loading: "async", v: "quarterly", language: "en", region: "GB" })}`;
    script.async = true;
    script.onerror = fail;
    script.nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? "";
    document.head.append(script);
  });
  return loading;
}

export async function fetchGoogleMapsKey(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/api/maps/config", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
    if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
      const config = await response.json();
      return typeof config.apiKey === "string" ? config.apiKey : "";
    }
  } catch { /* A local demo can use its own saved Studio settings. */ }
  finally { clearTimeout(timeout); }
  if (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
    try { return JSON.parse(localStorage.getItem("kingsvale-studio-settings-v1") ?? "{}").googleMapsApiKey ?? ""; } catch { return ""; }
  }
  return "";
}
