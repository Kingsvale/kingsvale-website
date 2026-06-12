import type {
  TrackingMilestoneState,
  TrackingQrStyle,
  TrackingResource,
  TrackingResourceType,
  TrackingSite,
  TrackingStatus
} from "./trackingTypes";
import { validateTrackingSite } from "./trackingValidation";
import { boundedPercent, presetRoundness } from "./qrStyle";

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
<<<<<<< HEAD
  const sites = loadLocalTrackingSites();
  const nextSite = normalizeTrackingSite({
    ...site,
    reference: normalizeReference(site.reference || nextTrackingReference(sites)),
    updatedAt: new Date().toISOString()
  });
  const validation = validateTrackingSite(nextSite);
=======
  const validation = validateTrackingSite(site);
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
  if (!validation.valid) {
    throw new Error("Tracking site is invalid and cannot be saved.");
  }

<<<<<<< HEAD
  ensureUniqueReference(nextSite, sites);
=======
  const sites = loadLocalTrackingSites();
  const nextSite = { ...site, updatedAt: new Date().toISOString() };
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
<<<<<<< HEAD
  const reference = nextTrackingReference(loadLocalTrackingSites());
  return {
    id: `tracking-${Date.now()}-${randomPart(4)}`,
    token: generateTrackingToken(),
    title: "New land interest map",
    customerName: "",
    siteAddress: "Site address",
    reference,
    summary: "View the title area Kingsvale is interested in so the proposal can be understood clearly.",
    mapEmbedUrl: "",
    searchlandUrl: "",
    privateNotes: "",
    currentStatus: "planning",
    statusNote: "Kingsvale is reviewing this land interest opportunity.",
    milestones: [
      createMilestone("Land interest area prepared", "active")
=======
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
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
<<<<<<< HEAD
    localAuthority: "Uncategorised",
=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
    createdAt: now,
    updatedAt: now,
    archived: false
  };
}

type LegacyQrStyle = Partial<TrackingQrStyle> & {
  dotStyle?: string;
  finderStyle?: string;
  frameStyle?: string;
};

export function normalizeTrackingSite(site: TrackingSite): TrackingSite {
  const qrStyle = (site.qrStyle ?? {}) as LegacyQrStyle;
  const defaultStyle = defaultQrStyle();
  return {
    ...site,
<<<<<<< HEAD
    reference: normalizeReference(site.reference ?? ""),
    mapEmbedUrl: normalizeMapEmbedInput(site.mapEmbedUrl ?? ""),
    searchlandUrl: site.searchlandUrl ?? "",
    privateNotes: site.privateNotes ?? "",
=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
    resources: Array.isArray(site.resources) ? site.resources : [],
    qrStyle: {
      foreground: qrStyle.foreground ?? defaultStyle.foreground,
      background: qrStyle.background ?? defaultStyle.background,
      accent: qrStyle.accent ?? defaultStyle.accent,
      dotRoundness: boundedPercent(qrStyle.dotRoundness, presetRoundness(qrStyle.dotStyle)),
      finderRoundness: boundedPercent(qrStyle.finderRoundness, presetRoundness(qrStyle.finderStyle)),
      frameRoundness: boundedPercent(qrStyle.frameRoundness, qrStyle.frameStyle === "square" ? 0 : 42),
      frameCut: boundedPercent(qrStyle.frameCut, qrStyle.frameStyle === "cut-corner" ? 36 : 0),
      frameLabel: qrStyle.frameLabel ?? defaultStyle.frameLabel,
      includeLogo: qrStyle.includeLogo ?? defaultStyle.includeLogo
    },
    council: {
      mode: site.council?.mode ?? "none",
      councilName: site.council?.councilName ?? "",
      applicationReference: site.council?.applicationReference ?? "",
      apiBaseUrl: site.council?.apiBaseUrl ?? "",
      lastCheckedAt: site.council?.lastCheckedAt ?? null,
      lastSyncStatus: site.council?.lastSyncStatus ?? "Not configured"
<<<<<<< HEAD
    },
    localAuthority: site.localAuthority || detectLocalAuthority(site.siteAddress) || "Uncategorised"
=======
    }
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
  };
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
    dotRoundness: 48,
    finderRoundness: 24,
    frameRoundness: 42,
    frameCut: 0,
<<<<<<< HEAD
    frameLabel: "Scan to view the plot",
=======
    frameLabel: "Scan for project updates",
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
    includeLogo: true
  };
}

<<<<<<< HEAD
export function normalizeMapEmbedInput(value: string) {
  const trimmed = value.trim();
  const iframeSrc = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
  return preferSatelliteMap(decodeHtmlAttribute(iframeSrc ?? trimmed));
}

export function normalizeReference(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  const numeric = normalized.match(/^KV0*(\d+)$/)?.[1];
  return numeric ? `KV${numeric.padStart(4, "0")}` : normalized;
}

export function nextTrackingReference(sites: TrackingSite[]) {
  const max = sites.reduce((highest, site) => {
    const match = normalizeReference(site.reference).match(/^KV(\d{4,})$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return `KV${String(max + 1).padStart(4, "0")}`;
}

export function detectLocalAuthority(address: string) {
  const text = address.toLowerCase();
  const knownAuthorities = [
    "Wokingham",
    "Bracknell Forest",
    "Reading",
    "West Berkshire",
    "Windsor and Maidenhead",
    "Surrey Heath",
    "Guildford",
    "Hart",
    "Basingstoke and Deane",
    "Winchester",
    "London"
  ];
  const match = knownAuthorities.find((authority) => text.includes(authority.toLowerCase()));
  return match ? `${match} Council` : "";
}

function ensureUniqueReference(site: TrackingSite, sites: TrackingSite[]) {
  if (!site.reference) {
    return;
  }

  const duplicate = sites.some(
    (item) => item.id !== site.id && normalizeReference(item.reference) === site.reference
  );
  if (duplicate) {
    throw new Error("A site with this reference already exists.");
  }
}

function preferSatelliteMap(value: string) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    if (url.hostname === "www.google.com" && url.pathname.includes("/maps/d/embed")) {
      // Google My Maps embeds do not consistently honour a documented satellite-default option
      // across accounts and shared-map settings. `basemap=satellite` is the closest safe hint.
      url.searchParams.set("basemap", "satellite");
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
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
<<<<<<< HEAD

function decodeHtmlAttribute(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
=======
>>>>>>> ee14dfe16a5937e35e3aa5ae2ce7bcd0609ea05d
