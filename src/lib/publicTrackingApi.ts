import {
  findPublicLocalTrackingSiteByToken,
  loadPublicLocalTrackingSites,
  normalizePublicTrackingSite
} from "./trackingLocalRead";
import type { TrackingSite } from "./trackingTypes";

export async function fetchTrackingSiteByToken(token: string): Promise<TrackingSite | null> {
  try {
    const response = await fetch(`/api/tracking-sites/${encodeURIComponent(token)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      return isLocalDemoRuntime() ? findPublicLocalTrackingSiteByToken(token) : null;
    }

    const payload = (await response.json()) as { site: TrackingSite | null };
    return payload.site ? normalizePublicTrackingSite(payload.site) : null;
  } catch {
    return isLocalDemoRuntime() ? findPublicLocalTrackingSiteByToken(token) : null;
  }
}

export async function lookupTrackingSite(reference: string, postcode: string): Promise<TrackingSite | null> {
  try {
    const response = await fetch("/api/tracking-sites/lookup", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ reference, postcode })
    });

    if (!response.ok) {
      return isLocalDemoRuntime() ? lookupLocalTrackingSite(reference, postcode) : null;
    }

    const payload = (await response.json()) as { site: TrackingSite | null };
    return payload.site ? normalizePublicTrackingSite(payload.site) : null;
  } catch {
    return isLocalDemoRuntime() ? lookupLocalTrackingSite(reference, postcode) : null;
  }
}

function lookupLocalTrackingSite(reference: string, postcode: string) {
  const normalizedReference = reference.trim().toUpperCase();
  const normalizedPostcode = postcode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return loadPublicLocalTrackingSites().find((site) =>
    !site.archived &&
    site.reference.trim().toUpperCase() === normalizedReference &&
    extractPostcode(site.siteAddress) === normalizedPostcode
  ) ?? null;
}

function extractPostcode(address: string) {
  const match = address.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  return match ? match[1].replace(/[^A-Z0-9]/g, "") : "";
}

function isLocalDemoRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const { hostname, protocol } = window.location;
  return protocol === "file:" || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
