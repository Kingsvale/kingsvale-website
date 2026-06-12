import {
  findLocalTrackingSiteByToken,
  loadLocalTrackingSites,
  normalizeTrackingSite
} from "./trackingStorage";
import type { TrackingSite } from "./trackingTypes";

export async function fetchTrackingSiteByToken(token: string): Promise<TrackingSite | null> {
  try {
    const response = await fetch(`/api/tracking-sites/${encodeURIComponent(token)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      return findLocalTrackingSiteByToken(token);
    }

    const payload = (await response.json()) as { site: TrackingSite | null };
    return payload.site ? normalizeTrackingSite(payload.site) : null;
  } catch {
    return findLocalTrackingSiteByToken(token);
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
      return lookupLocalTrackingSite(reference, postcode);
    }

    const payload = (await response.json()) as { site: TrackingSite | null };
    return payload.site ? normalizeTrackingSite(payload.site) : null;
  } catch {
    return lookupLocalTrackingSite(reference, postcode);
  }
}

function lookupLocalTrackingSite(reference: string, postcode: string) {
  const normalizedReference = reference.trim().toUpperCase();
  const normalizedPostcode = postcode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return loadLocalTrackingSites().find((site) =>
    !site.archived &&
    site.reference.trim().toUpperCase() === normalizedReference &&
    extractPostcode(site.siteAddress) === normalizedPostcode
  ) ?? null;
}

function extractPostcode(address: string) {
  const match = address.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  return match ? match[1].replace(/[^A-Z0-9]/g, "") : "";
}
