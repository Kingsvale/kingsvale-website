import type { TrackingAddressParts, TrackingSite } from "./trackingTypes";

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
  const siteAddress = stringValue(site.siteAddress);

  return {
    id: stringValue(site.id),
    token: stringValue(site.token),
    title: stringValue(site.title, "Private plot map"),
    customerName: stringValue(site.customerName),
    siteAddress,
    siteAddressParts: normalizePublicAddressParts(site.siteAddressParts),
    reference: stringValue(site.reference),
    summary: stringValue(site.summary, "View the plot information Kingsvale has shared."),
    mapEmbedUrl: stringValue(site.mapEmbedUrl),
    statusNote: stringValue(site.statusNote, "Kingsvale is reviewing this land interest opportunity."),
    currentStatus: site.currentStatus ?? "planning",
    milestones: Array.isArray(site.milestones) ? site.milestones : [],
    resources: Array.isArray(site.resources) ? site.resources : [],
    createdAt: stringValue(site.createdAt, updatedAt),
    updatedAt,
    archived: Boolean(site.archived)
  } as TrackingSite;
}

function normalizePublicAddressParts(parts: Partial<TrackingAddressParts> | undefined): TrackingAddressParts {
  return {
    line1: stringValue(parts?.line1),
    line2: stringValue(parts?.line2),
    town: stringValue(parts?.town),
    county: stringValue(parts?.county),
    postcode: stringValue(parts?.postcode).toUpperCase()
  };
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
