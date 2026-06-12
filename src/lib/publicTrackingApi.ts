import {
  findLocalTrackingSiteByToken,
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
