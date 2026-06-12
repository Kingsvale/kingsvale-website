import type {
  TrackingMilestoneState,
  TrackingQrStyle,
  TrackingResource,
  TrackingResourceType,
  TrackingSite,
  TrackingStatus
} from "./trackingTypes";
import { validateTrackingSite } from "./trackingValidation";

export const trackingStorageKey = "kingsvale-tracking-sites-v1";

export function loadLocalTrackingSites(): TrackingSite[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(trackingStorageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as TrackingSite[];
    return Array.isArray(parsed)
      ? parsed
        .map(normalizeTrackingSite)
        .filter((site) => validateTrackingSite(site).valid)
      : [];
  } catch {
    return [];
  }
}

export function saveLocalTrackingSites(sites: TrackingSite[]) {
  window.localStorage.setItem(trackingStorageKey, JSON.stringify(sites));
  window.dispatchEvent(new Event("kingsvale-tracking-sites-updated"));
}

export function upsertLocalTrackingSite(site: TrackingSite): TrackingSite {
  const validation = validateTrackingSite(site);
  if (!validation.valid) {
    throw new Error("Tracking site is invalid and cannot be saved.");
  }

  const sites = loadLocalTrackingSites();
  const nextSite = { ...site, updatedAt: new Date().toISOString() };
  const nextSites = sites.some((item) => item.id === site.id)
    ? sites.map((item) => (item.id === site.id ? nextSite : item))
    : [nextSite, ...sites];
  saveLocalTrackingSites(nextSites);
  return nextSite;
}

export function archiveLocalTrackingSite(id: string): TrackingSite | null {
  const sites = loadLocalTrackingSites();
  const target = sites.find((site) => site.id === id);
  if (!target) {
    return null;
  }

  const nextSite = { ...target, archived: true, updatedAt: new Date().toISOString() };
  saveLocalTrackingSites(sites.map((site) => (site.id === id ? nextSite : site)));
  return nextSite;
}

export function findLocalTrackingSiteByToken(token: string): TrackingSite | null {
  return loadLocalTrackingSites().find((site) => site.token === token && !site.archived) ?? null;
}

export function createTrackingSite(): TrackingSite {
  const now = new Date().toISOString();
  return {
    id: `tracking-${Date.now()}-${randomPart(4)}`,
    token: generateTrackingToken(),
    title: "New customer tracking page",
    customerName: "",
    siteAddress: "Site address",
    reference: "",
    summary: "Track the planning and construction progress for this Kingsvale project.",
    currentStatus: "planning",
    statusNote: "Initial details are being prepared by the Kingsvale team.",
    milestones: [
      createMilestone("Planning details prepared", "active"),
      createMilestone("Application submitted", "pending"),
      createMilestone("Council review", "pending"),
      createMilestone("Decision issued", "pending"),
      createMilestone("Construction progress", "pending")
    ],
    resources: [],
    qrStyle: defaultQrStyle(),
    council: {
      mode: "none",
      councilName: "",
      applicationReference: "",
      apiBaseUrl: "",
      lastCheckedAt: null,
      lastSyncStatus: "Not configured"
    },
    createdAt: now,
    updatedAt: now,
    archived: false
  };
}

export function normalizeTrackingSite(site: TrackingSite): TrackingSite {
  const qrStyle = site.qrStyle ?? {};
  return {
    ...site,
    resources: Array.isArray(site.resources) ? site.resources : [],
    qrStyle: {
      ...defaultQrStyle(),
      ...qrStyle,
      dotRoundness: typeof qrStyle.dotRoundness === "number"
        ? qrStyle.dotRoundness
        : presetRoundness(qrStyle.dotStyle),
      finderRoundness: typeof qrStyle.finderRoundness === "number"
        ? qrStyle.finderRoundness
        : presetRoundness(qrStyle.finderStyle),
      frameRoundness: typeof qrStyle.frameRoundness === "number"
        ? qrStyle.frameRoundness
        : qrStyle.frameStyle === "square" ? 0 : 42,
      frameCut: typeof qrStyle.frameCut === "number"
        ? qrStyle.frameCut
        : qrStyle.frameStyle === "cut-corner" ? 36 : 0
    },
    council: {
      mode: site.council?.mode ?? "none",
      councilName: site.council?.councilName ?? "",
      applicationReference: site.council?.applicationReference ?? "",
      apiBaseUrl: site.council?.apiBaseUrl ?? "",
      lastCheckedAt: site.council?.lastCheckedAt ?? null,
      lastSyncStatus: site.council?.lastSyncStatus ?? "Not configured"
    }
  };
}

function presetRoundness(value?: string) {
  if (value === "square") {
    return 0;
  }
  if (value === "circle") {
    return 100;
  }
  return 48;
}

export function createMilestone(
  label = "New milestone",
  state: TrackingMilestoneState = "pending"
) {
  return {
    id: `milestone-${Date.now()}-${randomPart(4)}`,
    label,
    state,
    date: "",
    note: ""
  };
}

export function createTrackingResource(type: TrackingResourceType = "document"): TrackingResource {
  return {
    id: `resource-${Date.now()}-${randomPart(4)}`,
    type,
    title: type === "image" ? "Site image" : type === "link" ? "Useful link" : "Project document",
    url: "",
    note: ""
  };
}

export function defaultQrStyle(): TrackingQrStyle {
  return {
    foreground: "#22211d",
    background: "#fbf8f2",
    accent: "#ad9576",
    dotStyle: "rounded",
    finderStyle: "rounded",
    frameStyle: "rounded",
    dotRoundness: 48,
    finderRoundness: 24,
    frameRoundness: 42,
    frameCut: 0,
    frameLabel: "Scan for project updates",
    includeLogo: true
  };
}

export function trackingStatusClass(status: TrackingStatus) {
  return `tracking-status--${status.replace(/[^a-z0-9]+/g, "-")}`;
}

export function generateTrackingToken() {
  const bytes = new Uint8Array(18);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "")
      .slice(0, 24);
  }

  return `${randomPart(12)}${randomPart(12)}`.slice(0, 24);
}

function randomPart(length: number) {
  return Math.random().toString(36).slice(2, 2 + length);
}
