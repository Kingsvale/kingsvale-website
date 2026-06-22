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
  const siteAddressParts = {
    line1: stringValue(site.siteAddressParts?.line1),
    line2: stringValue(site.siteAddressParts?.line2),
    town: stringValue(site.siteAddressParts?.town),
    county: stringValue(site.siteAddressParts?.county),
    postcode: stringValue(site.siteAddressParts?.postcode).toUpperCase()
  };
  const {
    ownerAddress,
    titleNumber,
    plotDescription,
    ownerContactName,
    contactPriority,
    mailingStatus,
    firstMailedAt,
    lastMailedAt,
    royalMailTrackingNumber,
    trackingStatus,
    trackingLastCheckedAt,
    privateNotes,
    letterPresetId,
    letterRecipientMode,
    titleDeedFileName,
    titleDeedFileUrl,
    letterTemplateName,
    letterTemplateUrl,
    letterFileName,
    letterFileUrl,
    searchlandUrl,
    remailReminderDays,
    remailReminderDate,
    mailingNotes,
    mailingLastUpdatedAt,
    ...publicSite
  } = site;
  void ownerAddress;
  void titleNumber;
  void plotDescription;
  void ownerContactName;
  void contactPriority;
  void mailingStatus;
  void firstMailedAt;
  void lastMailedAt;
  void royalMailTrackingNumber;
  void trackingStatus;
  void trackingLastCheckedAt;
  void privateNotes;
  void letterPresetId;
  void letterRecipientMode;
  void titleDeedFileName;
  void titleDeedFileUrl;
  void letterTemplateName;
  void letterTemplateUrl;
  void letterFileName;
  void letterFileUrl;
  void searchlandUrl;
  void remailReminderDays;
  void remailReminderDate;
  void mailingNotes;
  void mailingLastUpdatedAt;

  return {
    ...publicSite,
    id: stringValue(site.id),
    token: stringValue(site.token),
    title: stringValue(site.title, "Private plot map"),
    customerName: stringValue(site.customerName),
    siteAddress: stringValue(site.siteAddress),
    siteAddressParts,
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
