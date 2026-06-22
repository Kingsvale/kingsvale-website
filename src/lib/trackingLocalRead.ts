import type { TrackingSite } from "./trackingTypes";

const trackingStorageKey = "kingsvale-tracking-sites-v1";

export function loadPublicLocalTrackingSites(): TrackingSite[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(trackingStorageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as TrackingSite[];
    return Array.isArray(parsed) ? parsed.map(normalizePublicTrackingSite) : [];
  } catch {
    return [];
  }
}

export function findPublicLocalTrackingSiteByToken(token: string): TrackingSite | null {
  return loadPublicLocalTrackingSites().find((site) => site.token === token && !site.archived) ?? null;
}

export function normalizePublicTrackingSite(site: Partial<TrackingSite>): TrackingSite {
  const updatedAt = typeof site.updatedAt === "string" && site.updatedAt ? site.updatedAt : new Date().toISOString();

  return {
    ...site,
    id: stringValue(site.id),
    token: stringValue(site.token),
    title: stringValue(site.title, "Private plot map"),
    customerName: stringValue(site.customerName),
    siteAddress: stringValue(site.siteAddress),
    reference: stringValue(site.reference),
    summary: stringValue(site.summary, "View the plot information Kingsvale has shared."),
    mapEmbedUrl: stringValue(site.mapEmbedUrl),
    statusNote: stringValue(site.statusNote, "Kingsvale is reviewing this land interest opportunity."),
    resources: Array.isArray(site.resources) ? site.resources : [],
    createdAt: stringValue(site.createdAt, updatedAt),
    updatedAt,
    archived: Boolean(site.archived)
  } as TrackingSite;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
