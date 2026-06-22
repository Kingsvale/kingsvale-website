import type {
  ContactPriority,
  MailingStatus,
  TrackingMilestoneState,
  TrackingResource,
  TrackingResourceType,
  TrackingSite,
  TrackingStatus
} from "./trackingTypes";
import { validateTrackingSite } from "./trackingValidation";
import { defaultQrStyle, normalizeTrackingSite } from "./trackingNormalize";

export {
  defaultQrStyle,
  buildAddressFromParts,
  detectSiteRegion,
  normalizeAddressParts,
  normalizeMapEmbedInput,
  normalizeTrackingSite,
  suggestRemailReminderDate
} from "./trackingNormalize";

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
  const duplicateReference = nextSite.reference.trim()
    ? sites.find(
        (item) =>
          item.id !== nextSite.id &&
          item.reference.trim().toUpperCase() === nextSite.reference.trim().toUpperCase()
      )
    : null;
  if (duplicateReference) {
    throw new Error("Tracking reference already exists.");
  }
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

export function unarchiveLocalTrackingSite(id: string): TrackingSite | null {
  const sites = loadLocalTrackingSites();
  const target = sites.find((site) => site.id === id);
  if (!target) {
    return null;
  }

  const nextSite = { ...target, archived: false, updatedAt: new Date().toISOString() };
  saveLocalTrackingSites(sites.map((site) => (site.id === id ? nextSite : site)));
  return nextSite;
}

export function deleteLocalTrackingSite(id: string): TrackingSite | null {
  const sites = loadLocalTrackingSites();
  const target = sites.find((site) => site.id === id);
  if (!target) {
    return null;
  }

  saveLocalTrackingSites(sites.filter((site) => site.id !== id));
  return target;
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
    siteAddress: "Address line 1, Town, AA1 1AA",
    siteAddressParts: {
      line1: "Address line 1",
      line2: "",
      town: "Town",
      county: "",
      postcode: "AA1 1AA"
    },
    ownerAddress: "",
    titleNumber: "",
    plotDescription: "",
    reference: "",
    region: "Uncategorised",
    ownerContactName: "",
    contactPriority: "unknown",
    summary: "View the title area Kingsvale is interested in so the proposal can be understood clearly.",
    mapEmbedUrl: "",
    privateNotes: "",
    letterPresetId: "",
    letterRecipientMode: "legal-owner",
    titleDeedFileName: "",
    titleDeedFileUrl: "",
    letterTemplateName: "",
    letterTemplateUrl: "",
    letterFileName: "",
    letterFileUrl: "",
    searchlandUrl: "",
    currentStatus: "planning",
    statusNote: "Kingsvale is reviewing this land interest opportunity.",
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
    mailingStatus: "not-mailed",
    firstMailedAt: "",
    lastMailedAt: "",
    royalMailTrackingNumber: "",
    trackingStatus: "Tracking unavailable",
    trackingLastCheckedAt: null,
    remailReminderDays: 14,
    remailReminderDate: "",
    mailingNotes: "",
    mailingLastUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
    archived: false
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

export function trackingStatusClass(status: TrackingStatus) {
  return `tracking-status--${status.replace(/[^a-z0-9]+/g, "-")}`;
}

export function mailingStatusClass(status: MailingStatus) {
  return `mailing-status--${status.replace(/[^a-z0-9]+/g, "-")}`;
}

export function priorityClass(priority: ContactPriority) {
  return `priority--${priority.replace(/[^a-z0-9]+/g, "-")}`;
}

export function isRemailReminderOverdue(site: TrackingSite, now = new Date()) {
  if (!site.remailReminderDate || site.mailingStatus === "responded" || site.mailingStatus === "do-not-contact") {
    return false;
  }

  const reminder = new Date(`${site.remailReminderDate}T23:59:59`);
  return !Number.isNaN(reminder.getTime()) && reminder < now;
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

