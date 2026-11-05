import type { TrackingAddressParts, TrackingSite } from "./trackingTypes";
import { publicLandMap } from "./landMap";
import { publicTrackingAddress } from "./trackingAddress.js";

const trackingStorageKey = "kingsvale-tracking-sites-v1";

export function loadPublicLocalTrackingSites(): TrackingSite[] {
  return loadRawLocalTrackingSites().map(normalizePublicTrackingSite);
}

export function lookupPublicLocalTrackingSite(reference: string, postcode: string): TrackingSite | null {
  const normalizedReference = reference.trim().toUpperCase();
  const normalizedPostcode = postcode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const site = loadRawLocalTrackingSites().find((item) =>
    !item.archived && stringValue(item.reference).trim().toUpperCase() === normalizedReference &&
    (stringValue(item.siteAddressParts?.postcode) || stringValue(item.siteAddress).match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)?.[0] || "")
      .toUpperCase().replace(/[^A-Z0-9]/g, "") === normalizedPostcode
  );
  return site ? normalizePublicTrackingSite(site) : null;
}

function loadRawLocalTrackingSites(): TrackingSite[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(trackingStorageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as TrackingSite[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

export function findPublicLocalTrackingSiteByToken(token: string): TrackingSite | null {
  return loadPublicLocalTrackingSites().find((site) => site.token === token && !site.archived) ?? null;
}

export function normalizePublicTrackingSite(site: Partial<TrackingSite>): TrackingSite {
  const updatedAt = typeof site.updatedAt === "string" && site.updatedAt ? site.updatedAt : new Date().toISOString();
  const address = publicTrackingAddress(site);

  return {
    id: stringValue(site.id),
    token: stringValue(site.token),
    title: stringValue(site.title, "Private plot map"),
    customerName: stringValue(site.customerName),
    siteAddress: stringValue(address.siteAddress),
    siteAddressParts: normalizePublicAddressParts(address.siteAddressParts),
    reference: stringValue(site.reference),
    summary: stringValue(site.summary, "View the plot information Kingsvale has shared."),
    mapEmbedUrl: stringValue(site.mapEmbedUrl),
    landMap: publicLandMap(site.landMap),
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
